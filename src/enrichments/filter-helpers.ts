/**
 * Small predicate helpers shared by the filter factories. Extracted from
 * `filter.ts` so each helper's complexity stays local to this module.
 */

import { cleanNumericCell } from '../core/type-detection';
import { gridCells, cellValue } from '../core/table-grid';

export function readNumericCell(row: HTMLTableRowElement, columnIndex: number): number | null {
  const cell = gridCells(row)[columnIndex];
  if (!cell) return null;
  const raw = cellValue(cell);
  return raw === '' ? null : cleanNumericCell(raw);
}

export function withinRange(v: number, min: number | null, max: number | null): boolean {
  if (min !== null && v < min) return false;
  if (max !== null && v > max) return false;
  return true;
}
