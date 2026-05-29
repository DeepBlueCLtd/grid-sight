/**
 * Pure outlier-mark math (spec 004-outlier, FR-003/FR-005/FR-009/FR-012).
 *
 * DOM-free apart from holding cell references, so every rule here is unit-
 * testable in isolation (`outlier-marks.test.ts`). Owns `OutlierThreshold` and
 * `OutlierMark`; `outlier.ts` re-exports them.
 */

import type { ColumnStatistics } from '../core/column-statistics';

/** Active sigma threshold. Idle is represented by `null` (the directive's absence). */
export type OutlierThreshold = 1 | 2 | 3;

/** A per-cell record for a marked cell while flagging is active. Transient —
 *  recomputed whenever the directive, the filter set, or the DOM changes. */
export interface OutlierMark {
  readonly cell: HTMLTableCellElement;
  /** The row's label cell text, for the list popup (FR-012). */
  readonly rowLabel: string;
  readonly value: number;
  /** Signed distance in σ: (value - mean) / stdDev. */
  readonly sigmaDistance: number;
}

/** The input shape `computeMarks` consumes — a numeric cell plus its context. */
export interface OutlierCandidate {
  readonly cell: HTMLTableCellElement;
  readonly rowLabel: string;
  readonly value: number;
}

/** Cycle order (FR-003): idle → 2 → 1 → 3 → idle. First activation is 2σ. */
export function nextThreshold(current: OutlierThreshold | null): OutlierThreshold | null {
  if (current === null) return 2;
  if (current === 2) return 1;
  if (current === 1) return 3;
  return null; // current === 3
}

/** Mark every cell with `|value − mean| > threshold · σ` (strict `>`, FR-005).
 *  Returns `[]` when σ is 0 or non-finite (inert column, FR-009). Output is in
 *  document order (input order preserved). */
export function computeMarks(
  cells: ReadonlyArray<OutlierCandidate>,
  stats: ColumnStatistics,
  threshold: OutlierThreshold,
): OutlierMark[] {
  const { mean, stdDev } = stats;
  if (!Number.isFinite(stdDev) || stdDev === 0) return [];
  const cutoff = threshold * stdDev;
  const out: OutlierMark[] = [];
  for (const c of cells) {
    if (Math.abs(c.value - mean) > cutoff) {
      out.push({
        cell: c.cell,
        rowLabel: c.rowLabel,
        value: c.value,
        sigmaDistance: (c.value - mean) / stdDev,
      });
    }
  }
  return out;
}

/** Descending `|σ|`; ties broken by document order (stable sort over input
 *  already in document order) — FR-012. */
export function sortMarksByDistance(marks: readonly OutlierMark[]): OutlierMark[] {
  return marks
    .slice()
    .sort((a, b) => Math.abs(b.sigmaDistance) - Math.abs(a.sigmaDistance));
}

/** Tooltip text (FR-007): e.g. `"value 135, mean 100.0, +3.5σ"`.
 *  `mean` is passed in (not re-derived) so it matches the shared statistics. */
export function formatOutlierTooltip(mark: OutlierMark, mean: number): string {
  const sign = mark.sigmaDistance >= 0 ? '+' : '-';
  const sigma = `${sign}${Math.abs(mark.sigmaDistance).toFixed(1)}σ`;
  return `value ${formatOutlierValue(mark.value)}, mean ${mean.toFixed(1)}, ${sigma}`;
}

/** Compact value rendering: integers as-is, else up to 2 decimals with trailing
 *  zeros trimmed (135 → "135", 4.2 → "4.2", 4.257 → "4.26"). Shared with the
 *  list popup so both readouts format values identically. */
export function formatOutlierValue(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return String(Number(v.toFixed(2)));
}
