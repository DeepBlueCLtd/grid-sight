import { describe, it, expect } from 'vitest';
import { quantile } from 'simple-statistics';
import { calculateStatistics, HISTOGRAM_BINS } from '../statistics';

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

  it('builds HISTOGRAM_BINS bins; the max value lands in the last bin', () => {
    const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const r = calculateStatistics(values);
    expect(r.histogram.length).toBe(HISTOGRAM_BINS);
    // Counts sum back to the number of finite values.
    expect(r.histogram.reduce((a, b) => a + b, 0)).toBe(values.length);
    expect(r.histogram[0]).toBe(1); // just 0 (width 1, [0,1))
    expect(r.histogram[HISTOGRAM_BINS - 1]).toBe(2); // 9 and 10 both clamp to last bin
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
