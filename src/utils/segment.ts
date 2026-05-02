/** Tiny linear-segment search helpers shared by the interpolation pipeline,
 *  the heatmap marker, and the slider-readout highlight logic. */

export function inSegment(a: number, b: number, x: number): boolean {
  const lo = a < b ? a : b;
  const hi = a < b ? b : a;
  return x >= lo && x <= hi;
}

/** First index `i` in `headers` such that `[headers[i], headers[i+1]]`
 *  brackets `x`. Returns `-1` if `x` is outside the range. Linear scan —
 *  axis lengths are bounded (≤ 50) per spec. */
export function locateSpan(headers: number[], x: number): number {
  for (let i = 0; i < headers.length - 1; i++) {
    if (inSegment(headers[i], headers[i + 1], x)) return i;
  }
  return -1;
}
