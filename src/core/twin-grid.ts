/**
 * Twin (grouped) table model — spec 016-twin-interpolation.
 *
 * A "twin" table stacks two or more independent lookup grids that share one
 * (column) axis. On the left sit label columns — a merged **group** column
 * (e.g. `Season`: Summer / Winter, authored with `rowspan`) followed by the
 * numeric **row-header** column (e.g. `Speed`) — then the numeric data columns
 * (e.g. `Direction`). A cell is addressed by (group, rowHeader, colHeader).
 *
 * The canonical addressing layer (`table-grid.ts`) assumes exactly one leading
 * row-header column and no row grouping, so it mis-reads this shape (see
 * specs/016-twin-interpolation/investigation.md §2). This module is a PURE,
 * rowspan-aware read that partitions the body into one sub-grid per group. It
 * never mutates the DOM.
 */

import { parseHeaderNumber } from '../utils/sync-key';
import { isScaffold, isVirtualColumn, cellValue } from './table-grid';

/** One season block: an independent rowHeader × colHeader sub-grid. */
export interface TwinBlock {
  /** The group label, e.g. "Summer". */
  label: string;
  /** The merged group `<th>` (rowspan cell) that opens this block. */
  groupCell: HTMLTableCellElement;
  /** Body rows belonging to this block, in DOM order. */
  rows: HTMLTableRowElement[];
  /** Numeric row-header (Speed) value per block row. */
  rowHeaders: number[];
  /** The row-header `<th>`/`<td>` per block row (for tagging / highlight). */
  rowHeaderCells: HTMLTableCellElement[];
  /** rowHeaders.length × colHeaders.length numeric data matrix. */
  matrix: number[][];
  /** rowHeaders.length × colHeaders.length data cells (for tagging / highlight). */
  dataCells: HTMLTableCellElement[][];
}

export interface TwinModel {
  /** Shared numeric column-axis (Direction) values. */
  colHeaders: number[];
  /** Number of leading label columns (group + row-header ⇒ 2 in the base case). */
  labelColumnCount: number;
  blocks: TwinBlock[];
}

/** Non-scaffold, non-virtual cells of a row, in DOM order. */
function realCells(row: HTMLTableRowElement): HTMLTableCellElement[] {
  return Array.from(row.cells).filter((c) => !isScaffold(c) && !isVirtualColumn(c));
}

function headerAndBody(table: HTMLTableElement): {
  header: HTMLTableRowElement | null;
  body: HTMLTableRowElement[];
} {
  const thead = table.tHead;
  const theadRows = thead ? Array.from(thead.rows).filter((r) => !isScaffold(r)) : [];
  const tbody = table.tBodies[0];
  const tbodyRows = tbody ? Array.from(tbody.rows).filter((r) => !isScaffold(r)) : [];
  if (theadRows.length > 0) return { header: theadRows[0], body: tbodyRows };
  if (
    tbodyRows.length > 0 &&
    Array.from(tbodyRows[0].cells).some((c) => c.tagName === 'TH')
  ) {
    return { header: tbodyRows[0], body: tbodyRows.slice(1) };
  }
  return { header: tbodyRows[0] ?? null, body: tbodyRows };
}

/**
 * Detect and model a twin table, or return null if `table` is not one.
 *
 * Recognised shape (the base case the reproduction uses):
 *  - a header row of ≥ 4 source cells;
 *  - a group column at logical index 0 whose body cells carry `rowspan > 1`;
 *  - a numeric row-header column at index 1;
 *  - ≥ 2 numeric data columns after that, shared by every block;
 *  - ≥ 2 groups, each a contiguous run of ≥ 2 body rows.
 *
 * Anything more exotic (nested groups, non-numeric row headers, a single group)
 * returns null so callers fall back to the existing fail-closed behaviour.
 */
export function detectTwin(table: HTMLTableElement): TwinModel | null {
  if (table.hasAttribute('data-gs-ignore') || table.hasAttribute('data-gs-no-twin')) {
    return null;
  }
  const { header, body } = headerAndBody(table);
  if (!header || body.length < 4) return null;

  const headerCells = realCells(header);
  if (headerCells.length < 4) return null;

  // Base case: exactly two label columns (group + row-header).
  const labelColumnCount = 2;
  const colHeaders = headerCells.slice(labelColumnCount).map((c) => parseHeaderNumber(cellValue(c)));
  if (colHeaders.length < 2 || colHeaders.some((n) => n === null)) return null;
  const colHeaderNums = colHeaders as number[];

  // Walk the body, opening a new block whenever a row leads with a rowspan cell.
  const blocks: TwinBlock[] = [];
  let current: TwinBlock | null = null;
  let sawGroupCell = false;

  for (const row of body) {
    const cells = realCells(row);
    if (cells.length === 0) return null;

    const leadsWithGroup = (cells[0].rowSpan ?? 1) > 1;
    let idx = 0;
    if (leadsWithGroup) {
      sawGroupCell = true;
      current = {
        label: cellValue(cells[0]),
        groupCell: cells[0],
        rows: [],
        rowHeaders: [],
        rowHeaderCells: [],
        matrix: [],
        dataCells: [],
      };
      blocks.push(current);
      idx = 1;
    }
    if (!current) return null; // body started without a group cell — not twin

    const rowHeaderCell = cells[idx];
    const speed = parseHeaderNumber(cellValue(rowHeaderCell));
    if (speed === null) return null;

    const dataCells = cells.slice(idx + 1);
    if (dataCells.length !== colHeaderNums.length) return null; // ragged ⇒ not this shape
    const dataNums = dataCells.map((c) => parseHeaderNumber(cellValue(c)) ?? NaN);

    current.rows.push(row);
    current.rowHeaders.push(speed);
    current.rowHeaderCells.push(rowHeaderCell);
    current.matrix.push(dataNums);
    current.dataCells.push(dataCells);
  }

  if (!sawGroupCell || blocks.length < 2) return null;
  if (blocks.some((b) => b.rowHeaders.length < 2)) return null;

  return { colHeaders: colHeaderNums, labelColumnCount, blocks };
}

/** True if `table` is a twin table (cheap-ish; builds the model and discards). */
export function isTwinTable(table: HTMLTableElement): boolean {
  return detectTwin(table) !== null;
}
