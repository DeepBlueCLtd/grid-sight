import { describe, it, expect } from 'vitest';
import {
  nextThreshold,
  computeMarks,
  sortMarksByDistance,
  formatOutlierTooltip,
  type OutlierCandidate,
  type OutlierMark,
} from '../outlier-marks';
import type { ColumnStatistics } from '../../core/column-statistics';

function cand(value: number, rowLabel = `r${value}`): OutlierCandidate {
  // The cell identity is irrelevant to the pure math; use a fresh element.
  return { cell: document.createElement('td'), rowLabel, value };
}

const STATS = (mean: number, stdDev: number, numericCount = 10): ColumnStatistics => ({
  mean,
  stdDev,
  numericCount,
});

describe('nextThreshold', () => {
  it('cycles idle → 2 → 1 → 3 → idle', () => {
    expect(nextThreshold(null)).toBe(2);
    expect(nextThreshold(2)).toBe(1);
    expect(nextThreshold(1)).toBe(3);
    expect(nextThreshold(3)).toBe(null);
  });
});

describe('computeMarks', () => {
  it('marks cells with strict |v − mean| > N·σ (boundary excluded)', () => {
    // mean 100, σ 10. At 2σ the cutoff is 20: 120 (==boundary) is NOT marked, 121 is.
    const cells = [cand(100), cand(120), cand(121), cand(79), cand(80)];
    const marks = computeMarks(cells, STATS(100, 10), 2);
    expect(marks.map((m) => m.value)).toEqual([121, 79]);
  });

  it('returns the signed σ distance per mark', () => {
    const marks = computeMarks([cand(135), cand(60)], STATS(100, 10), 2);
    expect(marks[0].sigmaDistance).toBeCloseTo(3.5, 10);
    expect(marks[1].sigmaDistance).toBeCloseTo(-4, 10);
  });

  it('σ = 0 → empty (inert column, FR-009)', () => {
    expect(computeMarks([cand(5), cand(5), cand(5)], STATS(5, 0), 1)).toEqual([]);
  });

  it('non-finite σ (empty stats) → empty', () => {
    expect(computeMarks([cand(5)], STATS(NaN, NaN, 0), 2)).toEqual([]);
  });

  it('preserves document order in the output', () => {
    const cells = [cand(200), cand(50), cand(300)];
    const marks = computeMarks(cells, STATS(100, 10), 2);
    expect(marks.map((m) => m.value)).toEqual([200, 50, 300]);
  });
});

describe('sortMarksByDistance', () => {
  it('sorts by descending |σ| with document-order tie-break', () => {
    const mk = (value: number, sigmaDistance: number, rowLabel: string): OutlierMark => ({
      cell: document.createElement('td'),
      rowLabel,
      value,
      sigmaDistance,
    });
    // Two ties at |σ| = 2 (a then b in doc order) plus a bigger and a smaller.
    const input = [mk(1, 2, 'a'), mk(2, -3, 'big'), mk(3, -2, 'b'), mk(4, 1, 'small')];
    const sorted = sortMarksByDistance(input);
    expect(sorted.map((m) => m.rowLabel)).toEqual(['big', 'a', 'b', 'small']);
  });
});

describe('formatOutlierTooltip', () => {
  it('formats "value 135, mean 100.0, +3.5σ"', () => {
    const mark: OutlierMark = {
      cell: document.createElement('td'),
      rowLabel: 'r',
      value: 135,
      sigmaDistance: 3.5,
    };
    expect(formatOutlierTooltip(mark, 100)).toBe('value 135, mean 100.0, +3.5σ');
  });

  it('uses a minus sign for below-mean outliers and trims decimals on the value', () => {
    const mark: OutlierMark = {
      cell: document.createElement('td'),
      rowLabel: 'r',
      value: 4.2,
      sigmaDistance: -2.25,
    };
    expect(formatOutlierTooltip(mark, 5)).toBe('value 4.2, mean 5.0, -2.3σ');
  });
});
