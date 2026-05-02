/**
 * Pure interpolation primitives for dynamic sliders.
 * No DOM dependency. See specs/001-dynamic-sliders/research.md §R-3.
 */

import { locateSpan } from './segment';

function lerp(x0: number, x1: number, y0: number, y1: number, x: number): number {
  if (x === x0) return y0;
  if (x === x1) return y1;
  if (x0 === x1) return y0;
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}

/** Linear 1-D interpolation between two nearest header values.
 * Returns NaN if `x` is out of range or interpolation hits a non-finite cell. */
export function linear1D(headers: number[], values: number[], x: number): number {
  if (headers.length !== values.length) return NaN;
  const i = locateSpan(headers, x);
  if (i < 0) return NaN;
  const y0 = values[i];
  const y1 = values[i + 1];
  if (x !== headers[i] && x !== headers[i + 1] && (!isFinite(y0) || !isFinite(y1))) return NaN;
  return lerp(headers[i], headers[i + 1], y0, y1, x);
}

/** Bilinear 2-D interpolation across the four cells surrounding (r, c).
 * `matrix[i][j]` corresponds to `rowHeaders[i]` × `colHeaders[j]`. */
export function bilinear(
  rowHeaders: number[],
  colHeaders: number[],
  matrix: number[][],
  r: number,
  c: number
): number {
  const i = locateSpan(rowHeaders, r);
  const j = locateSpan(colHeaders, c);
  if (i < 0 || j < 0) return NaN;

  const q00 = matrix[i]?.[j];
  const q01 = matrix[i]?.[j + 1];
  const q10 = matrix[i + 1]?.[j];
  const q11 = matrix[i + 1]?.[j + 1];
  if (![q00, q01, q10, q11].every(v => isFinite(v))) return NaN;

  const top = lerp(colHeaders[j], colHeaders[j + 1], q00, q01, c);
  const bot = lerp(colHeaders[j], colHeaders[j + 1], q10, q11, c);
  return lerp(rowHeaders[i], rowHeaders[i + 1], top, bot, r);
}
