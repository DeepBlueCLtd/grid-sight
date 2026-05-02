/**
 * Auto-detect cross-table slider sync via numeric-header signatures.
 * See specs/001-dynamic-sliders/research.md §R-4.
 */

import { cleanNumericCell } from '../core/type-detection';

/** Strip a trailing unit suffix (e.g. "kg", "m/s") and parse the leading number.
 * Handles scientific notation (1e3) which `cleanNumericCell` does not.
 * Returns null if the text cannot be parsed as a number. */
export function parseHeaderNumber(text: string): number | null {
  if (text == null) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Scientific notation form first — parseFloat handles it natively.
  const sciMatch = trimmed.match(/^-?\d+(?:\.\d+)?[eE][+-]?\d+/);
  if (sciMatch) {
    const n = parseFloat(sciMatch[0]);
    return isFinite(n) ? n : null;
  }

  const direct = cleanNumericCell(trimmed);
  if (direct !== null) return direct;

  // Strip a trailing unit suffix and re-parse.
  const numericPrefix = trimmed.match(/^-?[\d.,]+/);
  if (!numericPrefix) return null;
  return cleanNumericCell(numericPrefix[0]);
}

/** Derive the sync key for an axis given its raw header strings.
 * Returns null if any header fails to parse — those axes do not qualify for sliders
 * and therefore cannot sync.  */
export function deriveSyncKey(headerTexts: string[]): string | null {
  if (!headerTexts || headerTexts.length < 2) return null;
  const parsed: number[] = [];
  for (const t of headerTexts) {
    const n = parseHeaderNumber(t);
    if (n === null) return null;
    parsed.push(n);
  }
  return JSON.stringify(parsed);
}

/** Check whether two raw header lists produce the same sync key. */
export function headersMatch(a: string[], b: string[]): boolean {
  const ka = deriveSyncKey(a);
  if (ka === null) return false;
  return ka === deriveSyncKey(b);
}
