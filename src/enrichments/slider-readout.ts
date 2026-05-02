/**
 * Per-table readout pipeline: interpolated value, equation readout, value
 * labels, and four-cell highlight. Pulled out of slider.ts to keep individual
 * functions under the cyclomatic-complexity budget.
 */

import { bilinear } from '../utils/interpolation';
import { parseHeaderNumber } from '../utils/sync-key';
import { locateSpan } from '../utils/segment';
import { formatNumber } from '../ui/slider-control';
import type { TableContext } from './slider-injection';

export interface AxisSliderRef {
  axis: 'row' | 'col';
  position: number;
}

/** Half-open bracket [left, right] indices in `headers` whose values straddle x.
 *  Returns null if x is outside the header range. */
export function bracketIndices(headers: number[], x: number): [number, number] | null {
  const i = locateSpan(headers, x);
  return i < 0 ? null : [i, i + 1];
}

function clearHighlights(table: HTMLTableElement): void {
  for (const cell of table.querySelectorAll<HTMLElement>('.gs-slider-highlight')) {
    cell.classList.remove('gs-slider-highlight');
  }
}

function highlightCellGroup(
  table: HTMLTableElement,
  rPair: readonly number[],
  cPair: readonly number[]
): void {
  for (const ri of rPair) {
    for (const ci of cPair) {
      const cell = table.querySelector<HTMLElement>(`[data-gs-rc="${ri}:${ci}"]`);
      if (cell) cell.classList.add('gs-slider-highlight');
    }
  }
}

function highlightRowsOnly(table: HTMLTableElement, rPair: readonly number[]): void {
  for (const ri of rPair) {
    table.querySelectorAll<HTMLElement>(`[data-gs-rc^="${ri}:"]`)
      .forEach(c => c.classList.add('gs-slider-highlight'));
  }
}

function highlightColsOnly(table: HTMLTableElement, cPair: readonly number[]): void {
  const all = table.querySelectorAll<HTMLElement>('[data-gs-rc]');
  for (const ci of cPair) {
    const suffix = ':' + ci;
    all.forEach(c => {
      if ((c.getAttribute('data-gs-rc') ?? '').endsWith(suffix)) {
        c.classList.add('gs-slider-highlight');
      }
    });
  }
}

export function highlightCells(
  ctx: TableContext,
  rowPos: number | null,
  colPos: number | null
): void {
  clearHighlights(ctx.table);
  const rowVals = ctx.rowHeaders.map(t => parseHeaderNumber(t) ?? NaN);
  const colVals = ctx.colHeaders.map(t => parseHeaderNumber(t) ?? NaN);
  const rPair = rowPos !== null ? bracketIndices(rowVals, rowPos) : null;
  const cPair = colPos !== null ? bracketIndices(colVals, colPos) : null;

  if (rPair && cPair) highlightCellGroup(ctx.table, rPair, cPair);
  else if (rPair) highlightRowsOnly(ctx.table, rPair);
  else if (cPair) highlightColsOnly(ctx.table, cPair);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Interpolated readout                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

function midpoint(values: number[]): number {
  if (values.length >= 2) return (values[0] + values[values.length - 1]) / 2;
  return values[0] ?? 0;
}

function computeInterpolatedValue(
  ctx: TableContext,
  rowPos: number | null,
  colPos: number | null
): number {
  const rowVals = ctx.rowHeaders.map(t => parseHeaderNumber(t) ?? NaN);
  const colVals = ctx.colHeaders.map(t => parseHeaderNumber(t) ?? NaN);
  const r = rowPos ?? midpoint(rowVals);
  const c = colPos ?? midpoint(colVals);
  if (rowPos === null && colPos === null) return NaN;
  return bilinear(rowVals, colVals, ctx.cellMatrix, r, c);
}

function updateInterpolatedReadout(ctx: TableContext, text: string): void {
  if (!ctx.cornerCell) return;
  const interpEl = ctx.cornerCell.querySelector('[data-gs-slider-readout="interpolated"]');
  if (interpEl) interpEl.textContent = text;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Value labels                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

function updateValueLabels(
  ctx: TableContext,
  rowSlider: AxisSliderRef | null,
  colSlider: AxisSliderRef | null
): void {
  if (ctx.colValueSpan && colSlider) {
    ctx.colValueSpan.textContent = formatNumber(colSlider.position);
  }
  if (ctx.rowValueSpan && rowSlider) {
    ctx.rowValueSpan.textContent = formatNumber(rowSlider.position);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Equation readout                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

function evaluateFormula(
  formula: (rowVal: number, colVal: number) => number,
  rowVal: number,
  colVal: number
): string {
  try {
    const result = formula(rowVal, colVal);
    if (isFinite(result)) return formatNumber(result);
  } catch (err) {
    console.warn('[gridSight] formula threw:', err);
  }
  return '—';
}

function ensureEquationLine(ctx: TableContext): HTMLDivElement | null {
  if (!ctx.cornerCell) return null;
  if (ctx.equationLine) return ctx.equationLine;
  const line = document.createElement('div');
  line.setAttribute('data-gs-slider-readout', 'equation');
  line.setAttribute('aria-live', 'polite');
  line.style.fontSize = '11px';
  line.style.color = '#6a1b9a';
  ctx.cornerCell.appendChild(line);
  ctx.equationLine = line;
  return line;
}

function updateEquationReadout(
  ctx: TableContext,
  formula: ((rowVal: number, colVal: number) => number) | undefined,
  rowPos: number | null,
  colPos: number | null
): void {
  if (!formula) {
    ctx.equationLine?.remove();
    ctx.equationLine = null;
    return;
  }
  const rv = rowPos ?? (parseHeaderNumber(ctx.rowHeaders[0] ?? '') ?? 0);
  const cv = colPos ?? (parseHeaderNumber(ctx.colHeaders[0] ?? '') ?? 0);
  const line = ensureEquationLine(ctx);
  if (line) line.textContent = evaluateFormula(formula, rv, cv);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Top-level pipeline                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export function refreshTable(
  ctx: TableContext,
  rowSlider: AxisSliderRef | null,
  colSlider: AxisSliderRef | null,
  formula: ((rowVal: number, colVal: number) => number) | undefined
): void {
  updateValueLabels(ctx, rowSlider, colSlider);
  const rowPos = rowSlider?.position ?? null;
  const colPos = colSlider?.position ?? null;
  const v = computeInterpolatedValue(ctx, rowPos, colPos);
  updateInterpolatedReadout(ctx, isFinite(v) ? formatNumber(v) : '—');
  updateEquationReadout(ctx, formula, rowPos, colPos);
  highlightCells(ctx, rowPos, colPos);
}
