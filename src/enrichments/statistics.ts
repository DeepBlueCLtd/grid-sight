import {
  mean,
  median,
  min,
  max,
  sum,
  quantile
} from 'simple-statistics';
import { populationStdDev } from '../core/column-statistics';

/** Mini-histogram bin count: a capped square-root rule — `k = clamp(⌈√n⌉,
 *  MIN, MAX)` over the finite-value count `n` (spec 014 §R-4, revised). It
 *  adapts to the data size while staying legible at thumbnail width and bounding
 *  the per-bin label budget; Freedman–Diaconis is more "correct" for skewed data
 *  but produces a variable/huge count that would need clamping anyway. */
export const MIN_HISTOGRAM_BINS = 5;
export const MAX_HISTOGRAM_BINS = 12;
export function histogramBinCount(n: number): number {
  if (n <= 1) return 1;
  const k = Math.ceil(Math.sqrt(n));
  return Math.min(MAX_HISTOGRAM_BINS, Math.max(MIN_HISTOGRAM_BINS, k));
}

export interface StatisticsResult {
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  variance: number;
  // ── spec 014 extension ────────────────────────────────────────────────
  /** Visible cells in the scope that were blank / non-numeric (set by the
   *  caller's extraction layer — the numeric array has already dropped them). */
  missing: number;
  /** `missing / (count + missing)` as a percentage (0–100); 0 when no cells. */
  missingPct: number;
  /** Number of distinct finite numeric values. */
  distinct: number;
  /** 25th percentile (`simple-statistics.quantile`). */
  q1: number;
  /** 75th percentile. */
  q3: number;
  /** Equal-width bin counts over [min, max]; the count is `histogramBinCount`
   *  of the value count (capped √n). A single full bar `[count]` when every
   *  value is equal; `[]` when count is 0. */
  histogram: number[];
}

/** Build the equal-width bin counts over [minV, maxV]. The bin count follows
 *  the capped √n rule (`histogramBinCount`); the max value lands in the last
 *  bin; an all-equal column collapses to a single full bar. */
function buildHistogram(values: number[], minV: number, maxV: number): number[] {
  if (values.length === 0) return [];
  if (minV === maxV) return [values.length]; // all-equal → one bar
  const binCount = histogramBinCount(values.length);
  const width = (maxV - minV) / binCount;
  const bins = new Array<number>(binCount).fill(0);
  for (const v of values) {
    let idx = Math.floor((v - minV) / width);
    if (idx < 0) idx = 0;
    if (idx >= binCount) idx = binCount - 1;
    bins[idx] += 1;
  }
  return bins;
}

/**
 * Calculate statistics for an array of numbers.
 *
 * @param values  Numeric values (non-finite entries are filtered out).
 * @param missing Count of cells the caller saw but dropped as blank/non-numeric
 *                (extraction layer), used to populate `missing`/`missingPct`.
 *
 * MUST NOT throw on an empty array: returns a zero-count result with non-finite
 * numerics (the popup renders those as `N/A` and shows an empty state).
 */
export function calculateStatistics(values: number[], missing = 0): StatisticsResult {
  const validValues = values.filter(Number.isFinite);
  const count = validValues.length;
  const missingCount = Math.max(0, missing | 0);
  const total = count + missingCount;
  const missingPct = total > 0 ? (missingCount / total) * 100 : 0;

  if (count === 0) {
    // Empty state — never throw (replaces the historical throw).
    return {
      count: 0,
      sum: NaN,
      min: NaN,
      max: NaN,
      mean: NaN,
      median: NaN,
      stdDev: NaN,
      variance: NaN,
      missing: missingCount,
      missingPct,
      distinct: 0,
      q1: NaN,
      q3: NaN,
      histogram: [],
    };
  }

  const minV = min(validValues);
  const maxV = max(validValues);

  // σ is the POPULATION standard deviation (÷ n), derived from the single
  // shared authority in core/column-statistics so the statistics popup and the
  // outlier tooltip can never disagree (spec 004-outlier FR-024/SC-006,
  // research R-1). variance is reported as population variance (σ²) to stay
  // consistent with the reported σ.
  const m = mean(validValues);
  const stdDev = populationStdDev(validValues, m);

  return {
    count,
    sum: sum(validValues),
    min: minV,
    max: maxV,
    // Population σ / σ² from the shared column-statistics authority so the
    // statistics popup and the outlier tooltip can never disagree (spec 004
    // FR-024/SC-006), merged with the spec-014 profile fields.
    mean: m,
    median: median(validValues),
    stdDev,
    variance: stdDev * stdDev,
    missing: missingCount,
    missingPct,
    distinct: new Set(validValues).size,
    q1: quantile(validValues, 0.25),
    q3: quantile(validValues, 0.75),
    histogram: buildHistogram(validValues, minV, maxV),
  };
}

/**
 * Formats a number to a specified number of decimal places
 * @param value The number to format
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted number as a string
 */
export function formatNumber(value: number, decimals: number = 2): string {
  if (!Number.isFinite(value)) return 'N/A';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
}

/**
 * Converts statistics to a formatted string
 * @param stats StatisticsResult object
 * @returns Formatted string with statistics
 */
export function formatStatistics(stats: StatisticsResult): string {
  return [
    `Count: ${stats.count}`,
    `Sum: ${formatNumber(stats.sum)}`,
    `Min: ${formatNumber(stats.min)}`,
    `Max: ${formatNumber(stats.max)}`,
    `Mean: ${formatNumber(stats.mean)}`,
    `Median: ${formatNumber(stats.median)}`,
    `Std Dev: ${formatNumber(stats.stdDev)}`,
    `Variance: ${formatNumber(stats.variance)}`
  ].join('\n');
}
