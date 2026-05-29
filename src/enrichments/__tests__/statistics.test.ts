import { describe, it, expect, beforeEach } from 'vitest';
import { quantile } from 'simple-statistics';
import { calculateStatistics, histogramBinCount } from '../statistics';
import {
  computeColumnStatistics,
  columnNumericValues,
  columnNumericEntries,
} from '../../core/column-statistics';
import { computeMarks, formatOutlierTooltip } from '../outlier-marks';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('calculateStatistics — spec 014 extension', () => {
  it('keeps the existing figures correct', () => {
    const r = calculateStatistics([2, 4, 6, 8]);
    expect(r.count).toBe(4);
    expect(r.sum).toBe(20);
    expect(r.min).toBe(2);
    expect(r.max).toBe(8);
    expect(r.mean).toBe(5);
  });

  it('counts distinct finite values', () => {
    const r = calculateStatistics([1, 2, 2, 3, 3, 3]);
    expect(r.distinct).toBe(3);
  });

  it('computes q1/q3 via simple-statistics.quantile', () => {
    const values = [1, 2, 2, 3, 4, 5, 5, 5, 9, 10];
    const r = calculateStatistics(values);
    expect(r.q1).toBe(quantile(values, 0.25));
    expect(r.q3).toBe(quantile(values, 0.75));
    expect(r.q1).toBeLessThanOrEqual(r.median);
    expect(r.median).toBeLessThanOrEqual(r.q3);
  });

  it('populates missing/missingPct from the caller-supplied missing count', () => {
    // 8 finite values + 2 missing → 2 / 10 = 20%.
    const r = calculateStatistics([1, 2, 3, 4, 5, 6, 7, 8], 2);
    expect(r.missing).toBe(2);
    expect(r.missingPct).toBeCloseTo(20, 5);
  });

  it('defaults missing to 0 (missingPct 0) when not supplied', () => {
    const r = calculateStatistics([1, 2, 3]);
    expect(r.missing).toBe(0);
    expect(r.missingPct).toBe(0);
  });

  it('bins with the capped √n rule; counts sum to n and the max lands last', () => {
    const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // 11 values → ⌈√11⌉=4 → floor 5
    const r = calculateStatistics(values);
    expect(r.histogram.length).toBe(histogramBinCount(values.length));
    expect(r.histogram.length).toBe(5);
    expect(r.histogram.reduce((a, b) => a + b, 0)).toBe(values.length);
    expect(r.histogram[r.histogram.length - 1]).toBeGreaterThanOrEqual(1); // max in last bin
  });

  it('histogramBinCount clamps a square-root rule to [5, 12]', () => {
    expect(histogramBinCount(1)).toBe(1); // degenerate
    expect(histogramBinCount(4)).toBe(5); // ⌈√4⌉=2 → floored to 5
    expect(histogramBinCount(36)).toBe(6); // ⌈√36⌉=6
    expect(histogramBinCount(100)).toBe(10); // ⌈√100⌉=10
    expect(histogramBinCount(1000)).toBe(12); // ⌈√1000⌉=32 → capped to 12
  });

  it('collapses an all-equal column to a single full bar', () => {
    const r = calculateStatistics([7, 7, 7]);
    expect(r.histogram).toEqual([3]);
    expect(r.distinct).toBe(1);
    expect(r.min).toBe(7);
    expect(r.max).toBe(7);
  });

  it('returns a zero-count empty state instead of throwing on empty input', () => {
    expect(() => calculateStatistics([])).not.toThrow();
    const r = calculateStatistics([], 5);
    expect(r.count).toBe(0);
    expect(r.histogram).toEqual([]);
    expect(r.distinct).toBe(0);
    expect(r.missing).toBe(5);
    expect(r.missingPct).toBeCloseTo(100, 5); // every cell was missing
    // Numeric figures are non-finite so the popup renders them as N/A.
    expect(Number.isFinite(r.mean)).toBe(false);
    expect(Number.isFinite(r.q1)).toBe(false);
  });

  it('ignores non-finite entries already present in the array', () => {
    const r = calculateStatistics([1, NaN, 3, Infinity, 5]);
    expect(r.count).toBe(3);
    expect(r.sum).toBe(9);
  });
});

describe('calculateStatistics — population σ (spec 004 R-1)', () => {
  it('reports the POPULATION standard deviation (÷ n), not sample σ (÷ n−1)', () => {
    // mean 5, population variance 4, population σ 2 (sample σ would be ~2.138).
    const stats = calculateStatistics([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(stats.stdDev).toBeCloseTo(2, 10);
    expect(stats.variance).toBeCloseTo(4, 10); // population variance = σ²
    expect(stats.mean).toBeCloseTo(5, 10);
  });
});

describe('FR-024 / SC-006 — statistics popup and outlier tooltip agree', () => {
  it('the popup mean/σ and the outlier mean/σ derive from one shared computation', () => {
    const table = document.createElement('table');
    table.id = 'agree';
    table.innerHTML = `
      <thead><tr><th>Label</th><th>Val</th></tr></thead>
      <tbody>
        <tr><th>a</th><td>80</td></tr>
        <tr><th>b</th><td>95</td></tr>
        <tr><th>c</th><td>100</td></tr>
        <tr><th>d</th><td>105</td></tr>
        <tr><th>e</th><td>120</td></tr>
        <tr><th>f</th><td>135</td></tr>
      </tbody>`;
    document.body.appendChild(table);

    // Path A: the statistics-popup path — calculateStatistics over the column's
    // numeric values (the same values the popup's extractor would collect).
    const popup = calculateStatistics(columnNumericValues(table, 1));

    // Path B: the outlier path — computeColumnStatistics over the same column.
    const shared = computeColumnStatistics(table, 1);

    // They must agree to floating-point round-off (SC-006).
    expect(popup.mean).toBeCloseTo(shared.mean, 12);
    expect(popup.stdDev).toBeCloseTo(shared.stdDev, 12);

    // And an outlier tooltip formats the SAME mean the popup would show.
    const marks = computeMarks(columnNumericEntries(table, 1), shared, 1);
    expect(marks.length).toBeGreaterThan(0);
    const tip = formatOutlierTooltip(marks[0], shared.mean);
    expect(tip).toContain(`mean ${shared.mean.toFixed(1)}`);
  });
});
