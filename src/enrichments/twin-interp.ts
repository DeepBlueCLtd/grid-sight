/**
 * Pure per-block interpolation for twin tables (spec 016). No DOM.
 *
 * A twin block is interpolated exactly like a normal grid via the shared
 * `bilinear` primitive — the only twin-specific rule is *range divergence*: when
 * the shared Speed falls outside this block's row-header range (or the Direction
 * outside the shared column range), the block is "out of range" and must be
 * cleared (no value, no highlight), NOT clamped to an edge cell.
 */

import { bilinear } from '../utils/interpolation';
import { locateSpan } from '../utils/segment';

export interface BlockEval {
  /** True iff both speed and direction bracket a cell pair inside this block. */
  inRange: boolean;
  /** Interpolated value, or NaN when out of range / a bracketing cell is non-finite. */
  value: number;
  /** [i, i+1] row indices bracketing the speed, or null when out of range. */
  rowBracket: [number, number] | null;
  /** [j, j+1] column indices bracketing the direction, or null when out of range. */
  colBracket: [number, number] | null;
}

function bracket(headers: number[], x: number): [number, number] | null {
  const i = locateSpan(headers, x);
  return i < 0 ? null : [i, i + 1];
}

/** Evaluate one twin block at (speed, dir). Out-of-range ⇒ inRange:false, value:NaN. */
export function evalBlock(
  rowHeaders: number[],
  colHeaders: number[],
  matrix: number[][],
  speed: number,
  dir: number,
): BlockEval {
  const rowBracket = bracket(rowHeaders, speed);
  const colBracket = bracket(colHeaders, dir);
  if (!rowBracket || !colBracket) {
    return { inRange: false, value: NaN, rowBracket, colBracket };
  }
  const value = bilinear(rowHeaders, colHeaders, matrix, speed, dir);
  return { inRange: true, value, rowBracket, colBracket };
}

/** Inclusive [min, max] of a numeric header list (order-independent). */
export function headerRange(headers: number[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const h of headers) {
    if (h < lo) lo = h;
    if (h > hi) hi = h;
  }
  return [lo, hi];
}
