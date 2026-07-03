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
  // Cell-annotation note text (spec 006): the corner marker and the
  // visually-hidden aria-description node carry the GS-injected note body, which
  // is NOT author data — exclude it so column typing, search, and aggregates
  // read the underlying cell value. (The pin button is deliberately NOT listed:
  // its glyph is a symbol that does not affect numeric detection, and every
  // cell carries one — matching it here would force cellValue onto its clone
  // path for every cell and regress sort/aggregate performance.)
  '.gs-annotation-marker',
  '.gs-annotation-aria',
  // The GS on/off toggle is injected into the top-left header cell
  // (toggle-injector.ts). Its "GS" glyph is never author data, so strip it so
  // the corner column's header/value reads cleanly (e.g. CSV export, spec 009).
  '.grid-sight-toggle-container',
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
 * True when `row` is a merged "banner"/grouping super-header sitting above the
 * real (leaf) column-header row: it has fewer logical cells than the row below
 * it AND at least one of its cells spans multiple columns. The classic cases are
 * a single `<th colspan="N">` title (e.g. "Length Overall (m)") drawn above the
 * numeric column headers, and a corner label that spans down with `rowspan`. The
 * colspan requirement guards against mistaking a genuinely short header/data row
 * for a banner. `next` is the row immediately following, measured with the same
 * source-cell rule so both counts are comparable.
 */
function isBannerRow(
  row: HTMLTableRowElement,
  next: HTMLTableRowElement,
): boolean {
  const cells = sourceCells(row);
  if (cells.length >= sourceCells(next).length) return false;
  return cells.some((c) => Math.max(1, c.colSpan || 1) > 1);
}

/**
 * Resolve the header region into leading banner/grouping rows, the leaf
 * column-header row, and the body rows.
 *
 * Mirrors the header-detection rule in
 * `src/utils/original-order.ts::getDataRows` (header is `table.rows[0]` iff it
 * is the first row of the implicit/`tbody` block and contains a `<th>`; with an
 * explicit `<thead>` the body starts at the data rows). The rule is applied
 * AFTER removing scaffold rows: a row slider injects a scaffold `<tr>` carrying
 * a `<th>` corner ahead of the real header, so running the heuristic over the
 * raw rows (as `getDataRows` does) would mistake that scaffold row for the
 * header. We mirror rather than reuse `getDataRows` for exactly this reason.
 *
 * Leading merged banner/grouping rows (a full-width `<th colspan="N">` title, or
 * a `rowspan` corner + colspan banner above the numeric column headers) are
 * peeled off so `header` is the LEAF column-header row that aligns 1:1 with the
 * data columns. That is what lets sliders/interpolation bind to the numeric
 * column headers rather than to the banner (see `isBannerRow`, `dataHeaderCells`).
 */
function resolveHeader(table: HTMLTableElement): {
  banners: HTMLTableRowElement[];
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
    // Explicit head: the leaf header is the LAST head row; any earlier rows are
    // banner/grouping rows. body = all tbody data rows.
    const leaf = theadRows.length - 1;
    return {
      banners: theadRows.slice(0, leaf),
      header: theadRows[leaf],
      body: tbodyRows,
    };
  }
  // No <thead>: peel off leading merged banner rows, then the de-facto header is
  // the first remaining row iff it has a <th>.
  let start = 0;
  while (
    start + 1 < tbodyRows.length &&
    isBannerRow(tbodyRows[start], tbodyRows[start + 1])
  ) {
    start++;
  }
  const first = tbodyRows[start];
  if (first && Array.from(first.cells).some((c) => c.tagName === 'TH')) {
    return {
      banners: tbodyRows.slice(0, start),
      header: first,
      body: tbodyRows.slice(start + 1),
    };
  }
  return { banners: [], header: tbodyRows[0] ?? null, body: tbodyRows };
}

/** The (leaf) header row: the row whose cells align 1:1 with the data columns.
 *  Reuses the original-order header rule and peels off any merged banner rows. */
export function headerRow(table: HTMLTableElement): HTMLTableRowElement | null {
  return resolveHeader(table).header;
}

/** The full header block — leading banner/grouping rows followed by the leaf
 *  column-header row — top-to-bottom, non-scaffold. Single-row headers return a
 *  one-element array. */
export function headerRows(table: HTMLTableElement): HTMLTableRowElement[] {
  const { banners, header } = resolveHeader(table);
  return header ? [...banners, header] : [];
}

/** Non-scaffold data rows after the header, excluding <tfoot>. Dimmed rows kept. */
export function bodyRows(table: HTMLTableElement): HTMLTableRowElement[] {
  return resolveHeader(table).body;
}

/**
 * Occupancy-aware sweep of the header block (leading banner/grouping rows + the
 * leaf column-header row), honouring both colspan and rowspan. Returns, for each
 * logical SOURCE column, the header cell covering it AT the leaf row — which is
 * the leaf cell itself, or a corner label that spans DOWN into the leaf row from
 * a banner row (e.g. `<th rowspan="2">Speed Knots</th>`). Also reports which
 * leaf-row cell (if any) originates each logical column, so the row-label
 * column can be told apart from the data-column headers.
 */
function sweepHeaderColumns(table: HTMLTableElement): {
  perColumn: HTMLTableCellElement[];
  leafOriginCols: Set<number>;
} {
  const rows = headerRows(table);
  if (rows.length === 0) return { perColumn: [], leafOriginCols: new Set() };
  const leafIdx = rows.length - 1;
  // grid[r][c] = the cell covering logical column c of header row r (from that
  // row, or a rowspan spilling down from above).
  const grid: (HTMLTableCellElement | undefined)[][] = rows.map(() => []);
  const leafOriginCols = new Set<number>();
  for (let r = 0; r < rows.length; r++) {
    let c = 0;
    for (const cell of sourceCells(rows[r])) {
      while (grid[r][c]) c++;
      const cs = Math.max(1, cell.colSpan || 1);
      const rs = Math.max(1, cell.rowSpan || 1);
      if (r === leafIdx) leafOriginCols.add(c);
      for (let dr = 0; dr < rs && r + dr < rows.length; dr++) {
        for (let dc = 0; dc < cs; dc++) grid[r + dr][c + dc] = cell;
      }
      c += cs;
    }
  }
  const leaf = grid[leafIdx];
  const perColumn: HTMLTableCellElement[] = [];
  for (let c = 0; c < leaf.length; c++) if (leaf[c]) perColumn.push(leaf[c]!);
  return { perColumn, leafOriginCols };
}

/**
 * The header cell for every logical SOURCE column, in order — the row-label
 * corner first, then one per data column. Occupancy-aware over a multi-row
 * (banner) header. For a plain single-row header this equals `sourceCells`
 * expanded by colspan; callers that need the untouched single-row behaviour
 * should gate on `headerRows(table).length > 1`.
 */
export function sourceHeaderColumns(
  table: HTMLTableElement,
): HTMLTableCellElement[] {
  return sweepHeaderColumns(table).perColumn;
}

/**
 * The leaf header cells that head the DATA columns — every source cell of the
 * leaf header row except the one in the leading row-label column.
 *
 * Occupancy-aware over the whole header block (colspan + rowspan): a corner
 * label that spans DOWN into the leaf row from a banner row (e.g. a
 * `<th rowspan="2">Speed Knots</th>` beside a `<th colspan="N">` banner) shifts
 * the leaf row's cells to the right, so its first physical cell is correctly
 * recognised as a data-column header rather than dropped as the row label. For a
 * plain single-row header this is exactly `sourceCells(header).slice(1)`.
 */
export function dataHeaderCells(
  table: HTMLTableElement,
): HTMLTableCellElement[] {
  const { perColumn, leafOriginCols } = sweepHeaderColumns(table);
  // Logical column 0 is the row-label column. Keep the leaf-originated cells to
  // its right (a corner that spans down from a banner row is not a leaf cell, so
  // it is excluded automatically).
  return perColumn.filter((_, col) => col >= 1 && leafOriginCols.has(col));
}

/**
 * Author-text matrix aligned to logical SOURCE columns, for column-type
 * detection / suitability on a table with a multi-row (banner) header. Row 0 is
 * the leaf header aligned by logical column (occupancy-aware, so a rowspan
 * corner keeps the numeric leaf headers in their true columns); the remaining
 * rows are the body. Virtual columns are excluded.
 */
export function sourceColumnMatrix(table: HTMLTableElement): string[][] {
  const header = sourceHeaderColumns(table).map(cellValue);
  const body = bodyRows(table).map((row) => sourceCells(row).map(cellValue));
  return [header, ...body];
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
