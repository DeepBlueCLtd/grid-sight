import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openComparePicker } from '../compare-picker';
import { detachAll } from '../../enrichments/virtual-column';

function makeTable(): HTMLTableElement {
  const t = document.createElement('table');
  t.id = 'cmp-pick-table';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  ['Region', 'Q1', 'Q4'].forEach((h) => {
    const th = document.createElement('th');
    th.textContent = h;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  t.appendChild(thead);
  const tbody = document.createElement('tbody');
  [
    ['North', '100', '190'],
    ['South', '80', '110'],
  ].forEach((row) => {
    const tr = document.createElement('tr');
    row.forEach((v) => {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  t.appendChild(tbody);
  document.body.appendChild(t);
  return t;
}

function headerCells(table: HTMLTableElement): HTMLTableCellElement[] {
  return Array.from(table.tHead!.rows[0].cells);
}

beforeEach(() => {
  detachAll();
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('compare picker affordance (US3)', () => {
  it('highlights the lozenge and marks numeric headers as candidates while active', () => {
    const table = makeTable();
    const lozenge = document.createElement('button');
    document.body.appendChild(lozenge);

    openComparePicker(table, lozenge);

    expect(lozenge.classList.contains('gs-vc-pick-active')).toBe(true);
    const [region, q1, q4] = headerCells(table);
    // Numeric headers are clickable candidates; the categorical one is not.
    expect(q1.classList.contains('gs-vc-pick-target')).toBe(true);
    expect(q4.classList.contains('gs-vc-pick-target')).toBe(true);
    expect(region.classList.contains('gs-vc-pick-target')).toBe(false);
  });

  it('highlights each column as it is picked and resolves with both keys', async () => {
    const table = makeTable();
    const lozenge = document.createElement('button');
    document.body.appendChild(lozenge);

    const promise = openComparePicker(table, lozenge);
    const [, q1, q4] = headerCells(table);

    q1.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(q1.classList.contains('gs-vc-pick-active')).toBe(true);
    expect(q1.getAttribute('aria-pressed')).toBe('true');

    q4.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const result = await promise;
    expect(result).toEqual({ colKeyA: 'q1', colKeyB: 'q4' });

    // All highlights + candidate markers cleared once the compare column shows.
    expect(lozenge.classList.contains('gs-vc-pick-active')).toBe(false);
    for (const cell of headerCells(table)) {
      expect(cell.classList.contains('gs-vc-pick-active')).toBe(false);
      expect(cell.classList.contains('gs-vc-pick-target')).toBe(false);
    }
  });

  it('cancels (resolves null) when something other than a candidate header is clicked', async () => {
    const table = makeTable();
    const lozenge = document.createElement('button');
    document.body.appendChild(lozenge);
    const outside = document.createElement('div');
    document.body.appendChild(outside);

    const promise = openComparePicker(table, lozenge);
    // The outside-click canceller attaches on the next tick.
    vi.advanceTimersByTime(1);

    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const result = await promise;
    expect(result).toBeNull();
    expect(lozenge.classList.contains('gs-vc-pick-active')).toBe(false);
    expect(headerCells(table)[1].classList.contains('gs-vc-pick-target')).toBe(false);
  });

  it('Escape cancels and clears all highlights', async () => {
    const table = makeTable();
    const lozenge = document.createElement('button');
    document.body.appendChild(lozenge);

    const promise = openComparePicker(table, lozenge);
    headerCells(table)[1].dispatchEvent(new MouseEvent('click', { bubbles: true })); // pick A
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    const result = await promise;
    expect(result).toBeNull();
    expect(lozenge.classList.contains('gs-vc-pick-active')).toBe(false);
  });

  it('a candidate-header click does not trigger the outside-click canceller', async () => {
    const table = makeTable();
    const lozenge = document.createElement('button');
    document.body.appendChild(lozenge);

    const promise = openComparePicker(table, lozenge);
    vi.advanceTimersByTime(1); // arm the outside canceller

    const [, q1, q4] = headerCells(table);
    q1.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // Picking A must NOT have cancelled — picker still active, A still highlighted.
    expect(q1.classList.contains('gs-vc-pick-active')).toBe(true);
    q4.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(await promise).toEqual({ colKeyA: 'q1', colKeyB: 'q4' });
  });
});
