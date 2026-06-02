/**
 * Copy-as-CSV orchestrator (spec 009). Builds a rectangular export snapshot of
 * a table's current visible view and serialises it to CSV / TSV / Markdown.
 *
 * Read-only over the source DOM: it consumes the sanctioned read-channels
 * (`visibleBodyRows`, the `table-grid` addressing layer, and the
 * `copy-as-csv-registry` virtual-column exporters) and never mutates author
 * content. The popup / toast UI live in `src/ui/`; this module owns the model,
 * the serialiser routing, and the teardown that closes any open UI.
 */

import { visibleBodyRows } from '../utils/visible-rows';
import {
  headerRow,
  gridCells,
  sourceCells,
  isVirtualColumn,
  headerCellFor,
  cellValue,
} from '../core/table-grid';
import { listVirtualColumnsForCopy } from '../utils/copy-as-csv-registry';
import { toCsv, toTsv, toMarkdown, type ColumnAlign } from './csv-serialize';
import type { CopyOptions } from '../utils/copy-persistence';

/* ── Export model ───────────────────────────────────────────────────── */

export interface ExportColumn {
  kind: 'row-header' | 'source' | 'virtual';
  headerText: string;
  align: ColumnAlign;
}

export interface ExportModel {
  columns: ExportColumn[];
  rows: HTMLTableRowElement[];
  matrix: string[][];
  rowCount: number;
  colCount: number;
}

/** Total visual width (sum of colSpan) of the source header cells. Falls back to
 *  the widest visible body row when the table has no header row. */
function sourceWidth(table: HTMLTableElement, rows: HTMLTableRowElement[]): number {
  const h = headerRow(table);
  if (h) {
    let n = 0;
    for (const c of gridCells(h)) {
      if (isVirtualColumn(c)) continue;
      n += Math.max(1, c.colSpan || 1);
    }
    if (n > 0) return n;
  }
  let widest = 0;
  for (const row of rows) {
    let n = 0;
    for (const c of sourceCells(row)) n += Math.max(1, c.colSpan || 1);
    widest = Math.max(widest, n);
  }
  return widest;
}

/** Number of leading source columns that are row-headers (`<th>` cells at the
 *  start of a body row, typically `scope="row"`). */
function rowHeaderColCount(rows: HTMLTableRowElement[]): number {
  const first = rows[0];
  if (!first) return 0;
  let n = 0;
  for (const c of sourceCells(first)) {
    if (c.tagName === 'TH') n += Math.max(1, c.colSpan || 1);
    else break;
  }
  return n;
}

/** A column is right-aligned when every non-empty value parses as a finite
 *  number (and at least one does). */
function detectAlign(values: readonly string[]): ColumnAlign {
  let sawNumber = false;
  for (const v of values) {
    if (v === '') continue;
    if (!Number.isFinite(Number(v))) return 'left';
    sawNumber = true;
  }
  return sawNumber ? 'right' : 'left';
}

/** Build the rectangular export snapshot for the current visible view. Reads
 *  only; mutates nothing. Rows with `data-gs-no-export` are excluded even when
 *  visible (FR-024). Span-covered / short positions are emitted as `''`. */
export function buildExportModel(
  table: HTMLTableElement,
  options: CopyOptions,
): ExportModel {
  const rows = visibleBodyRows(table).filter(
    (r) => !r.hasAttribute('data-gs-no-export'),
  );

  const nSrc = sourceWidth(table, rows);
  const h = headerRow(table);

  // Source header text, one entry per logical slot (colspan headers repeat).
  const srcHeader: string[] = [];
  for (let slot = 0; slot < nSrc; slot++) {
    const hc = h ? headerCellFor(table, slot) : null;
    srcHeader.push(hc ? cellValue(hc) : '');
  }

  // Source body matrix via slot-occupancy flatten (rowspan + colspan).
  const srcMatrix: string[][] = [];
  const carry = new Array<number>(nSrc).fill(0);
  for (const row of rows) {
    const out = new Array<string>(nSrc).fill('');
    const cells = sourceCells(row);
    let slot = 0;
    let ci = 0;
    while (slot < nSrc) {
      if (carry[slot] > 0) {
        carry[slot] -= 1; // covered by a rowspan from above → stays ''
        slot += 1;
        continue;
      }
      const cell = cells[ci++];
      if (!cell) {
        slot += 1;
        continue;
      }
      const cspan = Math.max(1, cell.colSpan || 1);
      const rspan = Math.max(1, cell.rowSpan || 1);
      out[slot] = cellValue(cell); // value at origin; colspan-covered stay ''
      if (rspan > 1) {
        for (let k = 0; k < cspan && slot + k < nSrc; k++) carry[slot + k] = rspan - 1;
      }
      slot += cspan;
    }
    srcMatrix.push(out);
  }

  // Drop leading row-header columns when the option is off.
  const drop = options.rowHeaders ? 0 : rowHeaderColCount(rows);
  const rhCount = rowHeaderColCount(rows);

  const columns: ExportColumn[] = [];
  const matrix: string[][] = rows.map(() => []);

  for (let slot = drop; slot < nSrc; slot++) {
    const colValues = srcMatrix.map((r) => r[slot]);
    columns.push({
      kind: slot < rhCount ? 'row-header' : 'source',
      headerText: srcHeader[slot],
      align: detectAlign(colValues),
    });
    for (let r = 0; r < rows.length; r++) matrix[r].push(srcMatrix[r][slot]);
  }

  // Virtual columns from the registry exporters, appended after the source set.
  if (options.virtualCols) {
    for (const { exporter } of listVirtualColumnsForCopy(table)) {
      const colValues = rows.map((row) => exporter.getCellText(row));
      columns.push({
        kind: 'virtual',
        headerText: exporter.headerText,
        align: detectAlign(colValues),
      });
      for (let r = 0; r < rows.length; r++) matrix[r].push(colValues[r]);
    }
  }

  return { columns, rows, matrix, rowCount: matrix.length, colCount: columns.length };
}

/** Serialise an ExportModel to the chosen format. Header row is included iff
 *  `options.headers`. */
export function serialiseModel(model: ExportModel, options: CopyOptions): string {
  const header = options.headers ? model.columns.map((c) => c.headerText) : null;
  const aligns = model.columns.map((c) => c.align);
  switch (options.format) {
    case 'tsv':
      return toTsv(header, model.matrix);
    case 'md':
      return toMarkdown(header, model.matrix, aligns);
    case 'csv':
    default:
      return toCsv(header, model.matrix);
  }
}

/* ── UI session registry + teardown ─────────────────────────────────── */
// The popup/toast live in src/ui; to avoid an enrichments → ui import they
// register disposers here (mirrors find-in-table's session registry).

const popupSessions = new WeakMap<HTMLTableElement, () => void>();
let toastHide: (() => void) | null = null;

/** Register a per-table popup disposer; closes any prior popup for the table. */
export function registerCopySession(table: HTMLTableElement, dispose: () => void): void {
  const prior = popupSessions.get(table);
  if (prior && prior !== dispose) prior();
  popupSessions.set(table, dispose);
}

export function clearCopySession(table: HTMLTableElement): void {
  popupSessions.delete(table);
}

/** The toast module registers its hide function at load (side-effect import). */
export function registerToastHide(fn: () => void): void {
  toastHide = fn;
}

/** Registry tearDown hook: close any open popup + toast for the table. No
 *  source-DOM changes to revert. */
export function removeCopyUi(table: HTMLTableElement): void {
  const dispose = popupSessions.get(table);
  if (dispose) dispose();
  popupSessions.delete(table);
  if (toastHide) toastHide();
}
