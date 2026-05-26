/**
 * Canonical table-grid addressing layer (spec 013-table-grid-addressing).
 *
 * The single authority for translating between a LOGICAL (row, column)
 * coordinate and a PHYSICAL live-DOM cell, and back. Everything is derived
 * from the live DOM plus the existing structural markers at call time — no
 * cached snapshots, no new markers — so results depend only on the current
 * DOM and never on the order in which enrichments were activated.
 *
 *  - Scaffolding cells/rows (`data-gs-injected`) are never part of the grid.
 *  - Virtual columns (`data-gs-virtual-column`) are real, addressable columns
 *    ordered after the source columns.
 *  - `cellValue` is the canonical "author data text of a cell" reader.
 *  - `logicalRowIndexOf` delegates to the Original Order Record for identity.
 *
 * All functions are PURE READS of the DOM; none mutate it.
 */

import { getRecord } from '../utils/original-order';

/* ── Marker constants (single source of truth) ──────────────────────── */

export const SCAFFOLD_ATTR = 'data-gs-injected';
export const VIRTUAL_COL_ATTR = 'data-gs-virtual-column';

/** Grid-Sight-owned descendants that `cellValue` strips before reading text. */
const GS_OWNED_SELECTOR = [
  '.gs-lozenge-cluster',
  '.gs-lozenge',
  '.gs-vc-lozenge',
  '.gs-plus-icon',
  '[data-gs-slider-readout]',
  '[data-gs-lozenge-id]',
  '[data-gs-vc-kind]',
].join(',');

/* ── Classification ─────────────────────────────────────────────────── */

/** True for slider scaffolding rows/cells — never part of the logical grid. */
export function isScaffold(el: Element): boolean {
  return el.hasAttribute(SCAFFOLD_ATTR);
}

/** True for a Grid-Sight-computed (virtual) column cell. */
export function isVirtualColumn(cell: Element): boolean {
  return cell.hasAttribute(VIRTUAL_COL_ATTR);
}

/* ── Rows ───────────────────────────────────────────────────────────── */

/** All non-scaffold rows, in DOM order (header + body, excludes <tfoot>).
 *  `table.rows` already orders thead rows, then table/tbody rows, then tfoot
 *  rows (HTML spec), so filtering out scaffold + footer rows preserves the
 *  header-then-body order. */
export function gridRows(table: HTMLTableElement): HTMLTableRowElement[] {
  const foot = footerRowSet(table);
  return Array.from(table.rows).filter((r) => !isScaffold(r) && !foot.has(r));
}

function footerRowSet(table: HTMLTableElement): Set<HTMLTableRowElement> {
  return new Set(table.tFoot ? Array.from(table.tFoot.rows) : []);
}

/**
 * Partition the non-scaffold rows into header + body.
 *
 * Mirrors the header-detection rule in
 * `src/utils/original-order.ts::getDataRows` (header is `table.rows[0]` iff it
 * is the first row of the implicit/`tbody` block and contains a `<th>`; with an
 * explicit `<thead>` the body starts at the data rows). The rule is applied
 * AFTER removing scaffold rows: a row slider injects a scaffold `<tr>` carrying
 * a `<th>` corner ahead of the real header, so running the heuristic over the
 * raw rows (as `getDataRows` does) would mistake that scaffold row for the
 * header. We mirror rather than reuse `getDataRows` for exactly this reason.
 */
function partitionRows(table: HTMLTableElement): {
  header: HTMLTableRowElement | null;
  body: HTMLTableRowElement[];
} {
  const thead = table.tHead;
  const theadRows = thead
    ? Array.from(thead.rows).filter((r) => !isScaffold(r))
    : [];
  const tbody = table.tBodies[0];
  const tbodyRows = tbody
    ? Array.from(tbody.rows).filter((r) => !isScaffold(r))
    : [];

  if (theadRows.length > 0) {
    // Explicit head: header = first head row; body = all tbody data rows.
    return { header: theadRows[0], body: tbodyRows };
  }
  // No <thead>: the de-facto header is the first tbody row iff it has a <th>.
  if (
    tbodyRows.length > 0 &&
    Array.from(tbodyRows[0].cells).some((c) => c.tagName === 'TH')
  ) {
    return { header: tbodyRows[0], body: tbodyRows.slice(1) };
  }
  return { header: tbodyRows[0] ?? null, body: tbodyRows };
}

/** The header row (first non-scaffold row; reuses original-order header rule). */
export function headerRow(table: HTMLTableElement): HTMLTableRowElement | null {
  return partitionRows(table).header;
}

/** Non-scaffold data rows after the header, excluding <tfoot>. Dimmed rows kept. */
export function bodyRows(table: HTMLTableElement): HTMLTableRowElement[] {
  return partitionRows(table).body;
}

/* ── Cells within a row ─────────────────────────────────────────────── */

/** Source + virtual columns (non-scaffold), DOM order: source first, virtual
 *  last (virtual columns are appended at the right edge). */
export function gridCells(row: HTMLTableRowElement): HTMLTableCellElement[] {
  return Array.from(row.cells).filter((c) => !isScaffold(c));
}

/** Source columns only (also excludes virtual). */
export function sourceCells(row: HTMLTableRowElement): HTMLTableCellElement[] {
  return Array.from(row.cells).filter(
    (c) => !isScaffold(c) && !isVirtualColumn(c),
  );
}

/* ── Column counts ──────────────────────────────────────────────────── */

export function sourceColumnCount(table: HTMLTableElement): number {
  const h = headerRow(table);
  return h ? sourceCells(h).length : 0;
}

export function gridColumnCount(table: HTMLTableElement): number {
  const h = headerRow(table);
  return h ? gridCells(h).length : 0;
}

/* ── Bidirectional translation ──────────────────────────────────────── */

/** The cell at logical (rowIndex, colIndex), or null if out of range.
 *  rowIndex addresses bodyRows(); colIndex addresses gridCells() of that row.
 *  Rowspan-safe: scaffold cells are filtered per row, so the K-th grid cell of
 *  a row that carries an injected rowspan cell still resolves to the same
 *  author column as a row that does not (INV-2). */
export function cellAt(
  table: HTMLTableElement,
  rowIndex: number,
  colIndex: number,
): HTMLTableCellElement | null {
  if (rowIndex < 0 || colIndex < 0) return null;
  const row = bodyRows(table)[rowIndex];
  if (!row) return null;
  return gridCells(row)[colIndex] ?? null;
}

/** Every body cell of logical column `colIndex`, one per body row, in body
 *  order. Empty array if colIndex is out of range. Rowspan-safe. */
export function columnCells(
  table: HTMLTableElement,
  colIndex: number,
): HTMLTableCellElement[] {
  if (colIndex < 0) return [];
  const out: HTMLTableCellElement[] = [];
  for (const row of bodyRows(table)) {
    const cell = gridCells(row)[colIndex];
    if (cell) out.push(cell);
  }
  return out;
}

/** The header cell for logical column `colIndex`, or null. For an author
 *  colspan header, any covered slot returns that header cell (R-6). */
export function headerCellFor(
  table: HTMLTableElement,
  colIndex: number,
): HTMLTableCellElement | null {
  if (colIndex < 0) return null;
  const h = headerRow(table);
  if (!h) return null;
  let slot = 0;
  for (const cell of gridCells(h)) {
    const span = Math.max(1, cell.colSpan || 1);
    if (colIndex < slot + span) return cell;
    slot += span;
  }
  return null;
}

/** Logical column index of `cell` within its row's grid cells, or -1. */
export function logicalColIndexOf(cell: HTMLTableCellElement): number {
  const row = cell.closest('tr');
  if (!row) return -1;
  return gridCells(row).indexOf(cell);
}

/** Logical row identity: index in the Original Order Record when present, else
 *  index within bodyRows(). Stable across sort reorder (INV-5). -1 if the row
 *  is not a body row of this table. */
export function logicalRowIndexOf(
  table: HTMLTableElement,
  row: HTMLTableRowElement,
): number {
  const record = getRecord(table);
  if (record) {
    const idx = record.indexOf(row);
    if (idx >= 0) return idx;
  }
  return bodyRows(table).indexOf(row);
}

/* ── Canonical value ────────────────────────────────────────────────── */

/** The author data text of a cell, excluding Grid-Sight-injected UI (lozenge
 *  clusters, slider readouts, etc.), trimmed. For a clean cell, equals
 *  cell.textContent.trim() (INV-1 / INV-8). Pure: never mutates `cell`. */
export function cellValue(cell: HTMLTableCellElement): string {
  if (!cell.querySelector(GS_OWNED_SELECTOR)) {
    return (cell.textContent ?? '').trim();
  }
  const clone = cell.cloneNode(true) as HTMLElement;
  for (const node of Array.from(clone.querySelectorAll(GS_OWNED_SELECTOR))) {
    node.remove();
  }
  return (clone.textContent ?? '').trim();
}
