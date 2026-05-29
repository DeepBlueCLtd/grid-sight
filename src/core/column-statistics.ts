/**
 * Shared column statistics — the single authority for a column's mean +
 * POPULATION standard deviation over a filter-aware numeric-cell set
 * (spec 004-outlier, research R-1).
 *
 * Consumed by BOTH the outlier enrichment and `statistics.ts` so the two views
 * never disagree (FR-024 / SC-006): there is exactly one σ formula and one
 * numeric-cell selection path. Population σ (÷ n) — the textbook "distance from
 * the mean of this set of values" — is used everywhere (research R-1).
 *
 * Lives in `core/` (not `enrichments/`) because two enrichment modules consume
 * it, mirroring `column-types-cache.ts` (plan §Structure Decision). Pure reads
 * of the live DOM; never mutates it; never throws.
 */

import { bodyRows, gridCells, cellValue } from './table-grid';
import { cleanNumericCell } from './type-detection';
import { getVisibleRows } from '../utils/visible-rows';

export interface ColumnStatistics {
  /** Arithmetic mean of the numeric cells in scope. */
  readonly mean: number;
  /** POPULATION standard deviation (÷ n). See research R-1. */
  readonly stdDev: number;
  /** Count of numeric cells that contributed (excludes non-numeric & dimmed). */
  readonly numericCount: number;
}

/** A numeric body cell in scope, with its row label (for the outliers list). */
export interface ColumnNumericEntry {
  readonly cell: HTMLTableCellElement;
  /** The row's label cell text (first grid cell), for the list popup (FR-012). */
  readonly rowLabel: string;
  readonly value: number;
}

export interface ColumnStatisticsScope {
  /** When true, rows currently dimmed by an active filter are excluded. */
  readonly excludeDimmed?: boolean;
}

/** Body rows currently dimmed by an active filter, per `getVisibleRows`.
 *  Returns null when dimming is not being applied (no allocation). */
function dimmedRowSet(
  table: HTMLTableElement,
  excludeDimmed: boolean,
): Set<HTMLTableRowElement> | null {
  if (!excludeDimmed) return null;
  const dimmed = new Set<HTMLTableRowElement>();
  for (const entry of getVisibleRows(table).entries) {
    if (entry.state === 'dimmed') dimmed.add(entry.rowEl);
  }
  return dimmed;
}

/** Numeric body entries of a logical column, in document order, excluding
 *  non-numeric cells and (when excludeDimmed) rows dimmed by an active filter.
 *  The richer sibling of `columnNumericValues`; the outlier enrichment uses it
 *  so the cells it marks are exactly the values the stats are computed over. */
export function columnNumericEntries(
  table: HTMLTableElement,
  columnIndex: number,
  scope?: ColumnStatisticsScope,
): ColumnNumericEntry[] {
  if (columnIndex < 0) return [];
  const dimmed = dimmedRowSet(table, !!scope?.excludeDimmed);
  const out: ColumnNumericEntry[] = [];
  for (const row of bodyRows(table)) {
    if (dimmed && dimmed.has(row)) continue;
    const cells = gridCells(row);
    const cell = cells[columnIndex];
    if (!cell) continue;
    const value = cleanNumericCell(cellValue(cell));
    if (value === null) continue;
    const rowLabel = cells[0] ? cellValue(cells[0]) : '';
    out.push({ cell, rowLabel, value });
  }
  return out;
}

/** Numeric values of a logical column, in document order, excluding non-numeric
 *  cells and (when excludeDimmed) rows currently dimmed by an active filter. */
export function columnNumericValues(
  table: HTMLTableElement,
  columnIndex: number,
  scope?: ColumnStatisticsScope,
): number[] {
  return columnNumericEntries(table, columnIndex, scope).map((e) => e.value);
}

/** Population σ over a numeric array (÷ n). Mean optional — computed if absent.
 *  Empty array → NaN (callers gate on count). Never throws. */
export function populationStdDev(values: number[], mean?: number): number {
  const n = values.length;
  if (n === 0) return NaN;
  const m = mean === undefined ? values.reduce((s, v) => s + v, 0) / n : mean;
  const variance = values.reduce((s, v) => s + (v - m) * (v - m), 0) / n;
  return Math.sqrt(variance);
}

/**
 * Compute `(mean, population σ, numericCount)` for a logical column.
 * `scope.excludeDimmed` removes rows dimmed by an active filter (FR-008).
 * Empty / empty-after-filter set → `{ mean: NaN, stdDev: NaN, numericCount: 0 }`
 * (callers gate on `numericCount`); never throws.
 */
export function computeColumnStatistics(
  table: HTMLTableElement,
  columnIndex: number,
  scope?: ColumnStatisticsScope,
): ColumnStatistics {
  const values = columnNumericValues(table, columnIndex, scope);
  const n = values.length;
  if (n === 0) return { mean: NaN, stdDev: NaN, numericCount: 0 };
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const stdDev = populationStdDev(values, mean);
  return { mean, stdDev, numericCount: n };
}
