import { describe, it, expect, beforeEach } from 'vitest';
import { applyFreezePanes, removeFreezePanes } from '../freeze-panes';

function makeTable(): HTMLTableElement {
  const t = document.createElement('table');
  t.innerHTML =
    '<thead><tr><th>Region</th><th>Q1</th><th>Q2</th></tr></thead>' +
    '<tbody>' +
    '<tr><th>North</th><td>10</td><td>11</td></tr>' +
    '<tr><th>South</th><td>20</td><td>21</td></tr>' +
    '</tbody>';
  document.body.appendChild(t);
  return t;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('freeze-panes', () => {
  it('tags every header-row cell with gs-freeze-header and marks the table', () => {
    const t = makeTable();
    applyFreezePanes(t);
    const headerCells = Array.from(t.tHead!.rows[0].cells);
    expect(headerCells.every((c) => c.classList.contains('gs-freeze-header'))).toBe(true);
    expect(t.classList.contains('gs-freeze')).toBe(true);
  });

  it('tags the first logical cell of every grid row with gs-freeze-col', () => {
    const t = makeTable();
    applyFreezePanes(t);
    // Header row corner + each body row's first cell, but not the others.
    expect(t.tHead!.rows[0].cells[0].classList.contains('gs-freeze-col')).toBe(true);
    for (const row of Array.from(t.tBodies[0].rows)) {
      expect(row.cells[0].classList.contains('gs-freeze-col')).toBe(true);
      expect(row.cells[1].classList.contains('gs-freeze-col')).toBe(false);
    }
  });

  it('resolves the key column via gridCells(row)[0], not :first-child, with a slider scaffold present', () => {
    const t = makeTable();
    const bodyRow = t.tBodies[0].rows[0];
    const scaffold = document.createElement('td');
    scaffold.setAttribute('data-gs-injected', '');
    bodyRow.insertBefore(scaffold, bodyRow.firstChild);

    applyFreezePanes(t);

    // The injected scaffold cell must never be tagged as the key column…
    expect(scaffold.classList.contains('gs-freeze-col')).toBe(false);
    // …the first AUTHOR cell (now at physical index 1) is.
    expect(bodyRow.cells[1].classList.contains('gs-freeze-col')).toBe(true);
  });

  it('marks the corner cell (header ∩ key) with both classes', () => {
    const t = makeTable();
    applyFreezePanes(t);
    const corner = t.tHead!.rows[0].cells[0];
    expect(corner.classList.contains('gs-freeze-header')).toBe(true);
    expect(corner.classList.contains('gs-freeze-col')).toBe(true);
  });

  it('is idempotent — a second apply does not duplicate classes', () => {
    const t = makeTable();
    applyFreezePanes(t);
    applyFreezePanes(t);
    const corner = t.tHead!.rows[0].cells[0];
    const tokens = corner.className.split(/\s+/).filter(Boolean);
    expect(tokens.filter((c) => c === 'gs-freeze-header').length).toBe(1);
    expect(tokens.filter((c) => c === 'gs-freeze-col').length).toBe(1);
  });

  it('preserves pre-existing classes on tagged cells through apply + teardown', () => {
    const t = makeTable();
    t.tBodies[0].rows[0].cells[1].className = 'num';
    const before = t.outerHTML;
    applyFreezePanes(t);
    removeFreezePanes(t);
    expect(t.outerHTML).toBe(before);
  });

  it('removeFreezePanes leaves byte-identical DOM', () => {
    const t = makeTable();
    const before = t.outerHTML;
    applyFreezePanes(t);
    removeFreezePanes(t);
    expect(t.outerHTML).toBe(before);
  });

  it('no-ops when the table has no grid rows', () => {
    const t = document.createElement('table');
    document.body.appendChild(t);
    const before = t.outerHTML;
    applyFreezePanes(t);
    expect(t.classList.contains('gs-freeze')).toBe(false);
    expect(t.outerHTML).toBe(before);
  });
});
