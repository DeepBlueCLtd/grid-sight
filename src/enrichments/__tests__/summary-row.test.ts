import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  aggregate,
  summarizeColumn,
  applySummaryRow,
  removeSummaryRow,
  __resetSummaryRow,
  type Aggregate,
} from '../summary-row';
import { setFilter, teardown as teardownVisibleRows, type FilterPredicate } from '../../utils/visible-rows';

function makeTable(id = 'sum-test'): HTMLTableElement {
  const t = document.createElement('table');
  t.id = id;
  t.innerHTML =
    '<thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead>' +
    '<tbody>' +
    '<tr><th>A</th><td>2</td><td>10</td></tr>' +
    '<tr><th>B</th><td>3</td><td>20</td></tr>' +
    '<tr><th>C</th><td>5</td><td></td></tr>' +
    '</tbody>';
  document.body.appendChild(t);
  return t;
}

function keepQtyAtLeast(min: number): FilterPredicate {
  return {
    columnIndex: 1,
    columnKey: 'qty',
    test: (row: HTMLTableRowElement) => {
      const v = parseFloat(row.cells[1]?.textContent ?? '');
      return Number.isFinite(v) && v >= min;
    },
    toDirective: () => ({ kind: 'numeric-range', columnKey: 'qty', min, max: null, hideEmpty: false }),
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  try { localStorage.clear(); } catch { /* ignore */ }
  __resetSummaryRow();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('summary-row — pure aggregate()', () => {
  it.each<[Aggregate, number]>([
    ['sum', 10],
    ['avg', 2.5],
    ['min', 1],
    ['max', 4],
    ['count', 4],
  ])('computes %s', (kind, expected) => {
    expect(aggregate([1, 2, 3, 4], kind)).toBe(expected);
  });

  it('returns NaN for an empty list', () => {
    expect(Number.isNaN(aggregate([], 'sum'))).toBe(true);
  });
});

describe('summary-row — summarizeColumn()', () => {
  it('numeric aggregates exclude blank / non-numeric cells', () => {
    expect(summarizeColumn(['1', '2', '', 'x', '3'], 'sum')).toBe('6');
  });
  it('count counts every non-blank cell (numeric or not)', () => {
    expect(summarizeColumn(['1', '2', '', 'x', '3'], 'count')).toBe('4');
  });
  it('renders blank when no numeric values remain', () => {
    expect(summarizeColumn(['a', 'b', ''], 'sum')).toBe('');
  });
});

describe('summary-row — footer rendering (jsdom)', () => {
  it('injects a footer aligned to logical columns, every cell data-gs-injected', () => {
    const t = makeTable();
    applySummaryRow(t);
    const footRow = t.tFoot!.querySelector('tr.gs-summary-row') as HTMLTableRowElement;
    const cells = Array.from(footRow.cells);
    expect(cells.length).toBe(3);
    expect(cells.every((c) => c.hasAttribute('data-gs-injected'))).toBe(true);
    expect(footRow.hasAttribute('data-gs-injected')).toBe(true);

    // Column 0 (Item) is a row-header column (<th> cells) → "Total" caption,
    // not an aggregate.
    expect(cells[0].querySelector('.gs-summary-label')!.textContent).toBe('Total');
    expect(cells[0].querySelector('.gs-summary-value')).toBeNull();
    // Numeric data columns still aggregate (sum by default).
    expect(cells[1].querySelector('.gs-summary-value')!.textContent).toBe('10'); // 2 + 3 + 5
    expect(cells[2].querySelector('.gs-summary-value')!.textContent).toBe('30'); // 10 + 20
  });

  it('does not aggregate a row-header column even if its labels look numeric', () => {
    // Numeric-looking row headers (e.g. axis labels) must still be captioned,
    // not summed.
    const t = document.createElement('table');
    t.id = 'num-headers';
    t.innerHTML =
      '<thead><tr><th>R</th><th>v</th></tr></thead>' +
      '<tbody>' +
      '<tr><th>1000</th><td>4.2</td></tr>' +
      '<tr><th>2000</th><td>3.6</td></tr>' +
      '</tbody>';
    document.body.appendChild(t);
    applySummaryRow(t);
    const footRow = t.tFoot!.querySelector('tr.gs-summary-row') as HTMLTableRowElement;
    expect(footRow.cells[0].querySelector('.gs-summary-label')!.textContent).toBe('Total');
    expect(footRow.cells[0].querySelector('.gs-summary-value')).toBeNull();
    expect(footRow.cells[1].querySelector('.gs-summary-value')!.textContent).toBe('7.8');
  });

  it('renders a keyboard-operable button control for numeric columns', () => {
    const t = makeTable();
    applySummaryRow(t);
    const btn = t.tFoot!.querySelector('.gs-summary-agg') as HTMLButtonElement;
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('aria-label')).toMatch(/Aggregate/);
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('recomputes every cell when the visible rows change', () => {
    const t = makeTable();
    applySummaryRow(t);
    const col1 = () =>
      (t.tFoot!.querySelector('tr.gs-summary-row') as HTMLTableRowElement).cells[1].querySelector(
        '.gs-summary-value',
      )!.textContent;
    expect(col1()).toBe('10');

    // Keep only Qty >= 4 → just row C (Qty 5) is visible.
    setFilter(t, 1, keepQtyAtLeast(4));
    expect(col1()).toBe('5');

    teardownVisibleRows(t);
  });

  it('switching the aggregate recomputes only that cell', () => {
    const t = makeTable();
    applySummaryRow(t);
    const btn = t.tFoot!.querySelector('.gs-summary-agg') as HTMLButtonElement; // Qty column
    const col1Value = () =>
      (t.tFoot!.querySelector('tr.gs-summary-row') as HTMLTableRowElement).cells[1].querySelector(
        '.gs-summary-value',
      )!.textContent;
    expect(col1Value()).toBe('10'); // sum
    btn.click(); // sum → avg
    expect(btn.textContent).toBe('avg');
    expect(col1Value()).toBe('3.33'); // (2+3+5)/3 ≈ 3.33
  });
});

describe('summary-row — persistence', () => {
  it('persists a per-column choice and restores it on re-apply', () => {
    const t = makeTable();
    applySummaryRow(t);
    const btn = t.tFoot!.querySelector('.gs-summary-agg') as HTMLButtonElement;
    btn.click(); // Qty: sum → avg (persisted)

    // Simulate reload: tear down + re-apply reads the persisted choice.
    removeSummaryRow(t);
    applySummaryRow(t);
    const btn2 = t.tFoot!.querySelector('.gs-summary-agg') as HTMLButtonElement;
    expect(btn2.textContent).toBe('avg');
  });

  it('ignores malformed persisted data and falls back to defaults', () => {
    const t = makeTable();
    localStorage.setItem(`gs:${location.origin + location.pathname}:summary:sum-test`, 'not-json{');
    expect(() => applySummaryRow(t)).not.toThrow();
    const btn = t.tFoot!.querySelector('.gs-summary-agg') as HTMLButtonElement;
    expect(btn.textContent).toBe('sum'); // default
  });

  it('degrades with a single warning when storage writes fail', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const t = makeTable();
    applySummaryRow(t);
    const btn = t.tFoot!.querySelector('.gs-summary-agg') as HTMLButtonElement;
    btn.click(); // write → throws → warn once
    btn.click(); // write → throws → already warned
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('summary-row — teardown', () => {
  it('removeSummaryRow leaves byte-identical DOM', () => {
    const t = makeTable();
    const before = t.outerHTML;
    applySummaryRow(t);
    removeSummaryRow(t);
    expect(t.outerHTML).toBe(before);
  });

  it('preserves an author <tfoot> on teardown', () => {
    const t = makeTable('with-foot');
    const tfoot = document.createElement('tfoot');
    tfoot.innerHTML = '<tr><td>author</td><td></td><td></td></tr>';
    t.appendChild(tfoot);
    const before = t.outerHTML;
    applySummaryRow(t);
    // Our row appended into the existing tfoot.
    expect(t.tFoot!.querySelectorAll('tr').length).toBe(2);
    removeSummaryRow(t);
    expect(t.outerHTML).toBe(before);
  });
});
