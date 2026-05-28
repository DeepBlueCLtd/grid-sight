/**
 * Per-table slider DOM injection.
 *
 * The orchestrator (`slider.ts`) drives slider creation; this module owns the
 * mechanical work of injecting the slider row + leftmost rowspan cell into a
 * host table and tearing them down on the last destroy. Pulled out so the
 * orchestrator stays under the file-size + complexity budgets.
 */

import { parseHeaderNumber } from '../utils/sync-key';
import { SLIDER_HIGHLIGHT_CLASSES } from './slider-readout';
import type { EquationSnapshot } from './equation-panel';
import {
  gridRows,
  bodyRows,
  headerRow as gridHeaderRow,
  sourceCells,
  cellValue,
} from '../core/table-grid';

export type Axis = 'row' | 'col';

export interface AxisBinding {
  axis: Axis;
  headerValues: number[];
  monotonicity: 'increasing' | 'decreasing';
  unitSuffix: string | null;
  cellMatrix: number[][];
  rowHeaderValues: number[];
  colHeaderValues: number[];
}

/** Per-table injection state, lazily built on first axis slider. */
export interface TableContext {
  table: HTMLTableElement;
  rowHeaders: string[];
  colHeaders: string[];
  cellMatrix: number[][];
  dataColumnCount: number;
  dataRowCount: number;
  topRow: HTMLTableRowElement | null;
  cornerCell: HTMLTableCellElement | null;
  colSliderCell: HTMLTableCellElement | null;
  rowSliderCell: HTMLTableCellElement | null;
  rowSliderHeaderCell: HTMLTableCellElement | null;
  colValueSpan: HTMLSpanElement | null;
  rowValueSpan: HTMLSpanElement | null;
  equationLine: HTMLDivElement | null;
  equationValue: HTMLSpanElement | null;
  equationInfoBtn: HTMLButtonElement | null;
  equationData: EquationSnapshot | null;
}

export const tableContexts = new WeakMap<HTMLTableElement, TableContext>();

/* ────────────────────────────────────────────────────────────────────────── */
/* Parsing helpers                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

/** Slider axis binding reads AUTHOR SOURCE cells only — virtual columns and
 *  injected scaffolding are excluded — via the canonical addressing layer, so
 *  axis binding is robust no matter what enrichments are active or the order
 *  they were activated (spec 013, R-2/R-5). `cellValue` strips injected UI so a
 *  lozenge present at slider-activation time can't corrupt the parsed value. */
function cellText(cell: HTMLTableCellElement): string {
  return cellValue(cell);
}

export function readRawAxisHeaders(table: HTMLTableElement, axis: Axis): string[] {
  if (axis === 'col') {
    const header = gridHeaderRow(table);
    if (!header) return [];
    return sourceCells(header).slice(1).map(cellText);
  }
  // axis === 'row'
  return bodyRows(table)
    .map(sourceCells)
    .filter(cells => cells.length > 0)
    .map(cells => cellText(cells[0]));
}

function parseCell(cell: HTMLTableCellElement): number {
  const n = parseHeaderNumber(cellText(cell));
  return n === null ? NaN : n;
}

function readDataRowAsNumbers(row: HTMLTableRowElement): number[] {
  const cells = sourceCells(row).slice(1);
  const out: number[] = [];
  for (const cell of cells) out.push(parseCell(cell));
  return out;
}

export function readRawCellMatrix(table: HTMLTableElement): number[][] {
  const out: number[][] = [];
  for (const row of bodyRows(table)) out.push(readDataRowAsNumbers(row));
  return out;
}

function detectMonotonicity(values: number[]): 'increasing' | 'decreasing' | null {
  if (values.length < 2) return null;
  let inc = true, dec = true;
  for (let i = 1; i < values.length; i++) {
    if (values[i] <= values[i - 1]) inc = false;
    if (values[i] >= values[i - 1]) dec = false;
  }
  if (inc) return 'increasing';
  if (dec) return 'decreasing';
  return null;
}

function detectUnitSuffix(headerTexts: string[]): string | null {
  for (const t of headerTexts) {
    const m = t.trim().match(/^-?[\d.,eE+-]+(?:\.[\d]+)?\s*([a-zA-Z%]+(?:\/[a-zA-Z]+)?)$/);
    if (m) return m[1];
  }
  return null;
}

export function buildAxisBinding(table: HTMLTableElement, axis: Axis): AxisBinding | null {
  const headerTexts = readRawAxisHeaders(table, axis);
  if (headerTexts.length < 2) return null;
  const headerValues: number[] = [];
  for (const t of headerTexts) {
    const n = parseHeaderNumber(t);
    if (n === null) return null;
    headerValues.push(n);
  }
  const monotonicity = detectMonotonicity(headerValues);
  if (monotonicity === null) return null;
  const cellMatrix = readRawCellMatrix(table);

  const rowHeaderValues = readRawAxisHeaders(table, 'row').map(t => parseHeaderNumber(t) ?? NaN);
  const colHeaderValues = readRawAxisHeaders(table, 'col').map(t => parseHeaderNumber(t) ?? NaN);

  return {
    axis,
    headerValues,
    monotonicity,
    unitSuffix: detectUnitSuffix(headerTexts),
    cellMatrix,
    rowHeaderValues,
    colHeaderValues,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Injection                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

function tagDataCells(table: HTMLTableElement): void {
  bodyRows(table).forEach((row, i) => {
    sourceCells(row).slice(1).forEach((cell, j) => {
      cell.setAttribute('data-gs-rc', `${i}:${j}`);
    });
  });
}

export function ensureInjection(table: HTMLTableElement): TableContext {
  const existing = tableContexts.get(table);
  if (existing) return existing;

  const colHeaders = readRawAxisHeaders(table, 'col');
  const rowHeaders = readRawAxisHeaders(table, 'row');
  const ctx: TableContext = {
    table,
    rowHeaders,
    colHeaders,
    cellMatrix: readRawCellMatrix(table),
    dataColumnCount: colHeaders.length,
    dataRowCount: rowHeaders.length,
    topRow: null,
    cornerCell: null,
    colSliderCell: null,
    rowSliderCell: null,
    rowSliderHeaderCell: null,
    colValueSpan: null,
    rowValueSpan: null,
    equationLine: null,
    equationValue: null,
    equationInfoBtn: null,
    equationData: null,
  };

  tagDataCells(table);
  tableContexts.set(table, ctx);
  return ctx;
}

function buildCornerCell(): HTMLTableCellElement {
  const corner = document.createElement('th');
  corner.setAttribute('data-gs-injected', '');
  corner.setAttribute('data-gs-corner', '');
  corner.style.minWidth = '7ch';
  corner.style.fontVariantNumeric = 'tabular-nums';
  corner.style.textAlign = 'center';
  corner.colSpan = 1;
  const interp = document.createElement('div');
  interp.setAttribute('data-gs-slider-readout', 'interpolated');
  interp.setAttribute('aria-live', 'polite');
  interp.setAttribute('role', 'status');
  interp.textContent = '—';
  corner.appendChild(interp);
  return corner;
}

function buildColSlotCell(dataColumnCount: number): HTMLTableCellElement {
  const colSlot = document.createElement('th');
  colSlot.setAttribute('data-gs-injected', '');
  colSlot.setAttribute('data-gs-col-slot', '');
  colSlot.colSpan = dataColumnCount;
  colSlot.style.padding = '4px 8px';
  return colSlot;
}

export function ensureTopRow(ctx: TableContext): HTMLTableRowElement {
  if (ctx.topRow) return ctx.topRow;

  const tr = document.createElement('tr');
  tr.setAttribute('data-gs-injected', '');
  const corner = buildCornerCell();
  const colSlot = buildColSlotCell(ctx.dataColumnCount);
  tr.appendChild(corner);
  tr.appendChild(colSlot);

  const firstOriginal = gridRows(ctx.table)[0];
  const tbody = ctx.table.tBodies[0] ?? ctx.table;
  if (firstOriginal) {
    firstOriginal.parentElement!.insertBefore(tr, firstOriginal);
  } else {
    tbody.appendChild(tr);
  }

  ctx.topRow = tr;
  ctx.cornerCell = corner;
  ctx.colSliderCell = colSlot;
  return tr;
}

function buildRowHeaderCell(): HTMLTableCellElement {
  const headerCell = document.createElement('th');
  headerCell.setAttribute('data-gs-injected', '');
  headerCell.setAttribute('data-gs-row-header', '');
  headerCell.style.padding = '6px';
  headerCell.style.verticalAlign = 'middle';
  headerCell.style.textAlign = 'center';
  headerCell.style.minWidth = '4ch';
  return headerCell;
}

function buildRowSliderCell(rowSpan: number): HTMLTableCellElement {
  const cell = document.createElement('th');
  cell.setAttribute('data-gs-injected', '');
  cell.setAttribute('data-gs-row-slot', '');
  cell.rowSpan = Math.max(1, rowSpan);
  cell.style.padding = '6px';
  cell.style.verticalAlign = 'middle';
  cell.style.textAlign = 'center';
  return cell;
}

export function ensureRowSliderSlot(ctx: TableContext): HTMLTableCellElement {
  if (ctx.rowSliderCell) return ctx.rowSliderCell;

  const headerRow = gridHeaderRow(ctx.table);
  if (!headerRow) throw new Error('No original header row found');

  const headerCell = buildRowHeaderCell();
  headerRow.insertBefore(headerCell, headerRow.firstChild);

  const cell = buildRowSliderCell(ctx.dataRowCount);
  // First body row (works whether the header lives in <thead> or the implicit
  // tbody block — `nextElementSibling` would be null for a <thead> header).
  const firstDataRow = bodyRows(ctx.table)[0] ?? null;
  if (firstDataRow) {
    firstDataRow.insertBefore(cell, firstDataRow.firstChild);
  } else {
    headerRow.parentElement!.appendChild(cell);
  }

  // Header row gained a leading cell — keep top row aligned.
  if (ctx.cornerCell) ctx.cornerCell.colSpan = 2;

  ctx.rowSliderCell = cell;
  ctx.rowSliderHeaderCell = headerCell;
  return cell;
}

/** Tear down the injection if no axis sliders remain on the host table. */
export function tearDownInjection(
  ctx: TableContext,
  hasAnyAxisSlider: boolean
): void {
  if (hasAnyAxisSlider) return;
  for (const cell of ctx.table.querySelectorAll<HTMLElement>('[data-gs-rc]')) {
    cell.removeAttribute('data-gs-rc');
    cell.classList.remove(...SLIDER_HIGHLIGHT_CLASSES);
  }
  ctx.topRow?.parentElement?.removeChild(ctx.topRow);
  ctx.rowSliderCell?.parentElement?.removeChild(ctx.rowSliderCell);
  ctx.rowSliderHeaderCell?.parentElement?.removeChild(ctx.rowSliderHeaderCell);
  tableContexts.delete(ctx.table);
}
