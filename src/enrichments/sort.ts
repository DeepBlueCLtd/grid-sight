/**
 * Sort enrichment — comparator + registration with the visible-rows pipeline.
 *
 * Implements the three-state cycle (asc → desc → off) via direct calls to
 * `setSort`. The lozenge UI lives in `src/ui/sort-lozenge.ts`.
 */

import { cleanNumericCell, type ColumnType } from '../core/type-detection';
import { registerComparatorFactory, type SortDirective } from '../utils/visible-rows';
import { gridCells, columnCells, cellValue } from '../core/table-grid';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export type SortColumnType = 'numeric' | 'categorical';

/** Read the logical column `columnIndex` of `row` as author data text — via the
 *  canonical addressing layer, so a row slider's injected cell never shifts the
 *  index and injected UI never pollutes the value (spec 013). */
function readCellAt(row: HTMLTableRowElement, columnIndex: number): string {
  const cell = gridCells(row)[columnIndex];
  return cell ? cellValue(cell) : '';
}

/** Build a comparator for a (column, direction, columnType) tuple. */
export function makeComparator(
  columnIndex: number,
  direction: 'asc' | 'desc',
  columnType: SortColumnType
): (a: HTMLTableRowElement, b: HTMLTableRowElement) => number {
  const sign = direction === 'asc' ? 1 : -1;
  if (columnType === 'numeric') {
    return (a, b) => {
      const av = cleanNumericCell(readCellAt(a, columnIndex));
      const bv = cleanNumericCell(readCellAt(b, columnIndex));
      // NaN / null → end of list in both directions.
      const aNaN = av === null;
      const bNaN = bv === null;
      if (aNaN && bNaN) return 0;
      if (aNaN) return 1;
      if (bNaN) return -1;
      if (av < bv) return -1 * sign;
      if (av > bv) return 1 * sign;
      return 0;
    };
  }
  return (a, b) => {
    const av = readCellAt(a, columnIndex);
    const bv = readCellAt(b, columnIndex);
    // Empty string → end.
    if (av === '' && bv === '') return 0;
    if (av === '') return 1;
    if (bv === '') return -1;
    return collator.compare(av, bv) * sign;
  };
}

/** Detect a column's data type by sampling first non-empty body cell. */
export function detectSortColumnType(
  table: HTMLTableElement,
  columnIndex: number
): SortColumnType {
  for (const cell of columnCells(table, columnIndex)) {
    const v = cellValue(cell);
    if (!v) continue;
    return cleanNumericCell(v) !== null ? 'numeric' : 'categorical';
  }
  return 'categorical';
}

/** Register the comparator factory with the pipeline (called once at module load). */
registerComparatorFactory((directive: SortDirective, table: HTMLTableElement) => {
  const type = detectSortColumnType(table, directive.columnIndex);
  return makeComparator(directive.columnIndex, directive.direction, type);
});

// Re-export ColumnType for callers that derive types externally.
export type { ColumnType };
