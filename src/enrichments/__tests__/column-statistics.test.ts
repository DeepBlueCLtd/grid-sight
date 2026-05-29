import { describe, it, expect, beforeEach } from 'vitest';
import {
  columnNumericValues,
  columnNumericEntries,
  populationStdDev,
  computeColumnStatistics,
} from '../../core/column-statistics';
import { setFilter, clearFilters, type FilterPredicate } from '../../utils/visible-rows';

/** Build a 2-column table (Label, Val) from a list of Val cell strings. */
function buildTable(vals: string[]): HTMLTableElement {
  const table = document.createElement('table');
  table.id = `cs-${Math.random().toString(36).slice(2, 8)}`;
  const body = vals
    .map((v, i) => `<tr><th>r${i}</th><td>${v}</td></tr>`)
    .join('');
  table.innerHTML = `<thead><tr><th>Label</th><th>Val</th></tr></thead><tbody>${body}</tbody>`;
  document.body.appendChild(table);
  return table;
}

/** A filter predicate that dims any row whose Val cell text is in `dimValues`. */
function dimPredicate(dimValues: string[]): FilterPredicate {
  return {
    columnIndex: 1,
    columnKey: 'val',
    test: (row) => !dimValues.includes((row.cells[1]?.textContent ?? '').trim()),
    toDirective: () => ({ kind: 'numeric-range', columnKey: 'val', min: null, max: null, hideEmpty: false }),
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('populationStdDev', () => {
  it('matches the textbook population σ (÷ n), not sample σ (÷ n−1)', () => {
    // Classic example: mean 5, variance 4, σ 2.
    expect(populationStdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 10);
  });

  it('uses a supplied mean when given (no re-derivation)', () => {
    expect(populationStdDev([10, 20, 30], 20)).toBeCloseTo(Math.sqrt(200 / 3), 10);
  });

  it('empty array → NaN, never throws', () => {
    expect(populationStdDev([])).toBeNaN();
  });
});

describe('computeColumnStatistics', () => {
  it('computes mean + population σ over the numeric cells', () => {
    const table = buildTable(['10', '20', '30']);
    const stats = computeColumnStatistics(table, 1);
    expect(stats.numericCount).toBe(3);
    expect(stats.mean).toBeCloseTo(20, 10);
    expect(stats.stdDev).toBeCloseTo(Math.sqrt(200 / 3), 10);
  });

  it('excludes non-numeric cells from mean/σ and the count', () => {
    const table = buildTable(['10', '20', '30', 'N/A', '']);
    const stats = computeColumnStatistics(table, 1);
    expect(stats.numericCount).toBe(3); // only 10/20/30 count
    expect(stats.mean).toBeCloseTo(20, 10);
  });

  it('excludeDimmed drops rows dimmed by an active filter', () => {
    const table = buildTable(['10', '20', '30']);
    setFilter(table, 1, dimPredicate(['30'])); // dim the 30 row
    const full = computeColumnStatistics(table, 1, { excludeDimmed: false });
    const scoped = computeColumnStatistics(table, 1, { excludeDimmed: true });
    expect(full.numericCount).toBe(3);
    expect(full.mean).toBeCloseTo(20, 10);
    expect(scoped.numericCount).toBe(2); // 10, 20
    expect(scoped.mean).toBeCloseTo(15, 10);
    expect(scoped.stdDev).toBeCloseTo(5, 10);
    clearFilters(table);
  });

  it('σ = 0 for all-equal values (returned, not thrown)', () => {
    const table = buildTable(['5', '5', '5']);
    const stats = computeColumnStatistics(table, 1);
    expect(stats.numericCount).toBe(3);
    expect(stats.mean).toBe(5);
    expect(stats.stdDev).toBe(0);
  });

  it('empty / empty-after-filter → numericCount 0 without throwing', () => {
    const empty = buildTable(['x', 'y', '']);
    expect(() => computeColumnStatistics(empty, 1)).not.toThrow();
    const stats = computeColumnStatistics(empty, 1);
    expect(stats.numericCount).toBe(0);
    expect(stats.mean).toBeNaN();
    expect(stats.stdDev).toBeNaN();

    const numeric = buildTable(['10', '20', '30']);
    setFilter(numeric, 1, dimPredicate(['10', '20', '30'])); // dim everything
    const afterFilter = computeColumnStatistics(numeric, 1, { excludeDimmed: true });
    expect(afterFilter.numericCount).toBe(0);
    clearFilters(numeric);
  });
});

describe('columnNumericValues / columnNumericEntries', () => {
  it('returns values in document order with row labels', () => {
    const table = buildTable(['10', '20', '30']);
    expect(columnNumericValues(table, 1)).toEqual([10, 20, 30]);
    const entries = columnNumericEntries(table, 1);
    expect(entries.map((e) => e.rowLabel)).toEqual(['r0', 'r1', 'r2']);
    expect(entries.map((e) => e.value)).toEqual([10, 20, 30]);
  });

  it('values and entries share the identical filtered set', () => {
    const table = buildTable(['10', '20', '30']);
    setFilter(table, 1, dimPredicate(['20']));
    const values = columnNumericValues(table, 1, { excludeDimmed: true });
    const entries = columnNumericEntries(table, 1, { excludeDimmed: true });
    expect(values).toEqual(entries.map((e) => e.value));
    expect(values).toEqual([10, 30]);
    clearFilters(table);
  });
});
