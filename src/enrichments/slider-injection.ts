/**
 * Per-table slider DOM injection.
 *
 * The orchestrator (`slider.ts`) drives slider creation; this module owns the
 * mechanical work of injecting the slider row + leftmost rowspan cell into a
 * host table and tearing them down on the last destroy. Pulled out so the
 * orchestrator stays under the file-size + complexity budgets.
 */

import { parseHeaderNumber } from '../utils/sync-key';

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
}

export const tableContexts = new WeakMap<HTMLTableElement, TableContext>();

/* ────────────────────────────────────────────────────────────────────────── */
/* Parsing helpers                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

function nonInjectedRows(table: HTMLTableElement): HTMLTableRowElement[] {
  return Array.from(table.rows).filter(r => !r.hasAttribute('data-gs-injected'));
}

function nonInjectedCells(row: HTMLTableRowElement): HTMLTableCellElement[] {
  return Array.from(row.cells).filter(c => !c.hasAttribute('data-gs-injected'));
}

function cellText(cell: HTMLTableCellElement): string {
  return cell.textContent?.trim() ?? '';
}

export function readRawAxisHeaders(table: HTMLTableElement, axis: Axis): string[] {
  const rows = nonInjectedRows(table);
  if (axis === 'col') {
    if (!rows[0]) return [];
    return nonInjectedCells(rows[0]).slice(1).map(cellText);
  }
  // axis === 'row'
  return rows.slice(1)
    .map(nonInjectedCells)
    .filter(cells => cells.length > 0)
    .map(cells => cellText(cells[0]));
}

function parseCell(cell: HTMLTableCellElement): number {
  const n = parseHeaderNumber(cellText(cell));
  return n === null ? NaN : n;
}

function readDataRowAsNumbers(row: HTMLTableRowElement): number[] {
  const cells = nonInjectedCells(row).slice(1);
  const out: number[] = [];
  for (const cell of cells) out.push(parseCell(cell));
  return out;
}

export function readRawCellMatrix(table: HTMLTableElement): number[][] {
  const dataRows = nonInjectedRows(table).slice(1);
  const out: number[][] = [];
  for (const row of dataRows) out.push(readDataRowAsNumbers(row));
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
  const rows = nonInjectedRows(table).slice(1);
  rows.forEach((row, i) => {
    nonInjectedCells(row).slice(1).forEach((cell, j) => {
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

  const firstOriginal = nonInjectedRows(ctx.table)[0];
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

  const headerRow = nonInjectedRows(ctx.table)[0];
  if (!headerRow) throw new Error('No original header row found');

  const headerCell = buildRowHeaderCell();
  headerRow.insertBefore(headerCell, headerRow.firstChild);

  const cell = buildRowSliderCell(ctx.dataRowCount);
  const firstDataRow = headerRow.nextElementSibling as HTMLTableRowElement | null;
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
    cell.classList.remove('gs-slider-highlight');
  }
  ctx.topRow?.parentElement?.removeChild(ctx.topRow);
  ctx.rowSliderCell?.parentElement?.removeChild(ctx.rowSliderCell);
  ctx.rowSliderHeaderCell?.parentElement?.removeChild(ctx.rowSliderHeaderCell);
  tableContexts.delete(ctx.table);
}
