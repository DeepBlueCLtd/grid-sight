/**
 * Compare virtual column renderer (spec 012-virtual-columns US3).
 * Δ <colB> − <colA> with abs / rel / percent modes.
 */

import type {
  CompareDirective,
  Renderer,
  VirtualColumnExport,
} from '../types/virtual-column';
import { cleanNumericCell } from '../core/type-detection';
import { registerRenderer, getSourceColumnIndex } from './virtual-column';
import { sourceCells, headerCellFor, cellValue } from '../core/table-grid';

function getRowValue(row: HTMLTableRowElement, colIndex: number): number | null {
  const cells = sourceCells(row);
  if (colIndex < 0 || colIndex >= cells.length) return null;
  return cleanNumericCell(cellValue(cells[colIndex]));
}

export function computeDelta(
  a: number | null,
  b: number | null,
  mode: 'abs' | 'rel' | 'percent',
): { value: number | null; placeholder: boolean } {
  if (a === null || b === null) return { value: null, placeholder: true };
  if (mode === 'abs') return { value: b - a, placeholder: false };
  if (mode === 'rel') {
    if (a === 0) return { value: null, placeholder: true };
    return { value: (b - a) / a, placeholder: false };
  }
  // percent
  if (a === 0) return { value: null, placeholder: true };
  return { value: ((b - a) / a) * 100, placeholder: false };
}

function directionGlyph(v: number): '▲' | '▼' | '=' {
  if (v > 0) return '▲';
  if (v < 0) return '▼';
  return '=';
}

function directionClass(v: number): 'gs-vc-up' | 'gs-vc-down' | 'gs-vc-eq' {
  if (v > 0) return 'gs-vc-up';
  if (v < 0) return 'gs-vc-down';
  return 'gs-vc-eq';
}

function format(value: number, mode: 'abs' | 'rel' | 'percent'): string {
  if (!isFinite(value)) return '—';
  if (mode === 'percent') return `${parseFloat(value.toFixed(2))}%`;
  if (mode === 'rel') return parseFloat(value.toFixed(4)).toString();
  return parseFloat(value.toFixed(4)).toString();
}

function getHeaderLabel(table: HTMLTableElement, colIdx: number): string {
  const cell = headerCellFor(table, colIdx);
  if (!cell) return `col-${colIdx}`;
  return cellValue(cell) || `col-${colIdx}`;
}

const compareRenderer: Renderer<CompareDirective> = {
  kind: 'compare',

  headerText(directive) {
    const aIdx = getSourceColumnIndex(directive.tableEl, directive.colKeyA);
    const bIdx = getSourceColumnIndex(directive.tableEl, directive.colKeyB);
    const aLabel = getHeaderLabel(directive.tableEl, aIdx);
    const bLabel = getHeaderLabel(directive.tableEl, bIdx);
    return `Δ ${bLabel} − ${aLabel}`;
  },

  canActivate(directive, _table, numericColumns) {
    return numericColumns.has(directive.colKeyA) && numericColumns.has(directive.colKeyB);
  },

  renderCell(directive, td, rowEl, _sequence, _rowIndex) {
    const aIdx = getSourceColumnIndex(directive.tableEl, directive.colKeyA);
    const bIdx = getSourceColumnIndex(directive.tableEl, directive.colKeyB);
    const a = getRowValue(rowEl, aIdx);
    const b = getRowValue(rowEl, bIdx);
    const result = computeDelta(a, b, directive.mode);
    if (result.placeholder || result.value === null) {
      td.textContent = '—';
      td.setAttribute('aria-label', 'no comparison');
      return;
    }
    const glyph = directionGlyph(result.value);
    const cls = directionClass(result.value);
    const text = format(result.value, directive.mode);
    td.textContent = `${glyph} ${text}`;
    td.classList.add(cls);
    td.setAttribute('aria-label', `${cls.replace('gs-vc-', '')} ${text}`);
  },

  onPipelineChange(directive, record, _sequence) {
    const aIdx = getSourceColumnIndex(directive.tableEl, directive.colKeyA);
    const bIdx = getSourceColumnIndex(directive.tableEl, directive.colKeyB);
    for (const [rowEl, td] of record.bodyCells) {
      const a = getRowValue(rowEl, aIdx);
      const b = getRowValue(rowEl, bIdx);
      const result = computeDelta(a, b, directive.mode);
      td.classList.remove('gs-vc-up', 'gs-vc-down', 'gs-vc-eq');
      if (result.placeholder || result.value === null) {
        td.textContent = '—';
        td.setAttribute('aria-label', 'no comparison');
        continue;
      }
      const glyph = directionGlyph(result.value);
      const cls = directionClass(result.value);
      const text = format(result.value, directive.mode);
      td.textContent = `${glyph} ${text}`;
      td.classList.add(cls);
      td.setAttribute('aria-label', `${cls.replace('gs-vc-', '')} ${text}`);
    }
  },

  exporter(directive): VirtualColumnExport {
    const aIdx = getSourceColumnIndex(directive.tableEl, directive.colKeyA);
    const bIdx = getSourceColumnIndex(directive.tableEl, directive.colKeyB);
    return {
      headerText: compareRenderer.headerText(directive),
      getCellText(rowEl) {
        const a = getRowValue(rowEl, aIdx);
        const b = getRowValue(rowEl, bIdx);
        const result = computeDelta(a, b, directive.mode);
        if (result.placeholder || result.value === null) return '';
        return format(result.value, directive.mode);
      },
    };
  },
};

registerRenderer(compareRenderer);

export { compareRenderer };
export const compareHelpers = { computeDelta, directionGlyph, format };
