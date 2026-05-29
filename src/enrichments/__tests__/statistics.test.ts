import { describe, it, expect, beforeEach } from 'vitest';
import { calculateStatistics } from '../statistics';
import {
  computeColumnStatistics,
  columnNumericValues,
} from '../../core/column-statistics';
import { computeMarks, formatOutlierTooltip } from '../outlier-marks';
import { columnNumericEntries } from '../../core/column-statistics';

beforeEach(() => {
  document.body.innerHTML = '';
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
