import { describe, it, expect } from 'vitest';
import { captureOnce, getRecord, clearRecord, restoreOriginalOrder } from '../original-order';

function makeTable(rows: number): HTMLTableElement {
  const table = document.createElement('table');
  const thead = table.createTHead();
  thead.insertRow().insertCell().textContent = 'H';
  const tbody = table.createTBody();
  for (let i = 0; i < rows; i++) {
    tbody.insertRow().insertCell().textContent = `r${i}`;
  }
  return table;
}

describe('original-order', () => {
  it('captures the OOR exactly once', () => {
    const t = makeTable(3);
    const first = captureOnce(t);
    expect(first).toHaveLength(3);
    // Subsequent calls return the same reference.
    expect(captureOnce(t)).toBe(first);
  });

  it('survives tbody re-ordering', () => {
    const t = makeTable(3);
    const rows = Array.from(t.tBodies[0].rows);
    const captured = captureOnce(t);
    // Re-order tbody.
    t.tBodies[0].appendChild(rows[0]);
    expect(captured[0]).toBe(rows[0]);
    expect(captured[1]).toBe(rows[1]);
    expect(captured[2]).toBe(rows[2]);
  });

  it('clearRecord removes the entry and getRecord returns null', () => {
    const t = makeTable(2);
    captureOnce(t);
    expect(getRecord(t)).not.toBeNull();
    clearRecord(t);
    expect(getRecord(t)).toBeNull();
  });

  it('restoreOriginalOrder is a no-op without a record', () => {
    const t = makeTable(2);
    expect(() => restoreOriginalOrder(t)).not.toThrow();
  });

  it('restoreOriginalOrder reseats tbody to OOR order', () => {
    const t = makeTable(3);
    const oor = captureOnce(t);
    const tbody = t.tBodies[0];
    // Reverse via direct DOM moves.
    tbody.appendChild(tbody.rows[0]);
    expect(tbody.rows[2]).toBe(oor[0]);
    restoreOriginalOrder(t);
    expect(tbody.rows[0]).toBe(oor[0]);
    expect(tbody.rows[1]).toBe(oor[1]);
    expect(tbody.rows[2]).toBe(oor[2]);
  });
});
