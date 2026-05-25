/**
 * Sparkline virtual column renderer (spec 012-virtual-columns US2/US4/US5).
 * Trend column with inline-SVG mini-bar-charts.
 */

import type {
  AppendedColumnRecord,
  Renderer,
  SparklineDirective,
  VirtualColumnExport,
  VisibleRowEntry,
} from '../types/virtual-column';
import { cleanNumericCell } from '../core/type-detection';
import {
  registerRenderer,
  getNumericColumns,
  getColumnKeys,
  mutateDirective,
} from './virtual-column';
import { buildSparklineSvg, updateSparklineSvg } from './sparkline-svg';

/* ── US4: tooltip + source-column highlight + arrow-key navigation ───── */

interface TooltipContext {
  el: HTMLDivElement;
  id: string;
  cells: HTMLTableCellElement[];
  numericIndices: number[];
  // Active cell ↔ event-handler bookkeeping, so multiple directives on the
  // same table don't double-bind. v1 ships a single sparkline per table.
  detach(): void;
}

const tooltipsByTable = new WeakMap<HTMLTableElement, TooltipContext>();
let tooltipIdSeq = 0;

function rowStatsLabel(values: Array<number | null>): string {
  const stats = rowStats(values);
  const parts: string[] = [];
  if (stats.min !== null) parts.push(`min ${stats.min}`);
  if (stats.max !== null) parts.push(`max ${stats.max}`);
  if (stats.last !== null) parts.push(`last ${stats.last}`);
  return parts.join(', ');
}

function clearHeaderHighlight(table: HTMLTableElement): void {
  const head = table.tHead?.rows[0];
  if (!head) return;
  for (const cell of Array.from(head.cells)) {
    cell.classList.remove('gs-vc-source-highlight');
  }
}

function applyHeaderHighlight(table: HTMLTableElement, indices: number[]): void {
  const head = table.tHead?.rows[0];
  if (!head) return;
  for (const i of indices) {
    const cell = head.cells[i];
    if (cell) cell.classList.add('gs-vc-source-highlight');
  }
}

function positionTooltip(tooltip: HTMLDivElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight - 4}px`;
  tooltip.style.left = `${rect.left + window.scrollX}px`;
  tooltip.style.visibility = 'visible';
}

function hideTooltip(tooltip: HTMLDivElement): void {
  tooltip.style.visibility = 'hidden';
  tooltip.textContent = '';
}

function createTooltip(table: HTMLTableElement): TooltipContext {
  const existing = tooltipsByTable.get(table);
  if (existing) return existing;

  const tooltip = document.createElement('div');
  tooltip.className = 'gs-vc-tooltip';
  tooltip.id = `gs-vc-tooltip-${++tooltipIdSeq}`;
  tooltip.setAttribute('role', 'tooltip');
  tooltip.style.visibility = 'hidden';
  document.body.appendChild(tooltip);

  const ctx: TooltipContext = {
    el: tooltip,
    id: tooltip.id,
    cells: [],
    numericIndices: [],
    detach() {
      hideTooltip(tooltip);
      clearHeaderHighlight(table);
      if (tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
      tooltipsByTable.delete(table);
    },
  };
  tooltipsByTable.set(table, ctx);
  return ctx;
}

function showCellTooltip(
  table: HTMLTableElement,
  td: HTMLTableCellElement,
  values: Array<number | null>,
  numericIndices: number[],
): void {
  const ctx = tooltipsByTable.get(table);
  if (!ctx) return;
  const label = rowStatsLabel(values) || 'no data';
  ctx.el.textContent = label;
  positionTooltip(ctx.el, td);
  applyHeaderHighlight(table, numericIndices);
}

function dismissTooltip(table: HTMLTableElement): void {
  const ctx = tooltipsByTable.get(table);
  if (!ctx) return;
  hideTooltip(ctx.el);
  clearHeaderHighlight(table);
}

function focusNeighbour(
  table: HTMLTableElement,
  current: HTMLTableCellElement,
  delta: -1 | 1,
): boolean {
  const ctx = tooltipsByTable.get(table);
  if (!ctx) return false;
  const i = ctx.cells.indexOf(current);
  if (i < 0) return false;
  const next = ctx.cells[i + delta];
  if (!next) return false;
  next.focus();
  return true;
}

function wireSparklineCell(
  table: HTMLTableElement,
  td: HTMLTableCellElement,
  numericIndices: number[],
): void {
  const ctx = createTooltip(table);
  if (!ctx.cells.includes(td)) ctx.cells.push(td);
  ctx.numericIndices = numericIndices;
  td.setAttribute('aria-describedby', ctx.id);

  const valuesForCell = (): Array<number | null> => {
    const row = td.parentElement as HTMLTableRowElement;
    return rowValues(row, numericIndices);
  };

  td.addEventListener('focus', () => {
    showCellTooltip(table, td, valuesForCell(), numericIndices);
  });
  td.addEventListener('blur', () => {
    dismissTooltip(table);
  });
  td.addEventListener('mouseenter', () => {
    showCellTooltip(table, td, valuesForCell(), numericIndices);
  });
  td.addEventListener('mouseleave', () => {
    dismissTooltip(table);
  });
  td.addEventListener('keydown', (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      dismissTooltip(table);
      return;
    }
    if (ev.key === 'ArrowDown') {
      if (focusNeighbour(table, td, 1)) ev.preventDefault();
      return;
    }
    if (ev.key === 'ArrowUp') {
      if (focusNeighbour(table, td, -1)) ev.preventDefault();
    }
  });
}

function detachSparklineInteractions(table: HTMLTableElement): void {
  const ctx = tooltipsByTable.get(table);
  if (ctx) ctx.detach();
}

function getNumericColumnIndices(directive: SparklineDirective): number[] {
  const keys = getColumnKeys(directive.tableEl);
  const numeric = getNumericColumns(directive.tableEl);
  const indices: number[] = [];
  keys.forEach((k, i) => {
    if (numeric.has(k)) indices.push(i);
  });
  return indices;
}

function rowValues(row: HTMLTableRowElement, indices: number[]): Array<number | null> {
  return indices.map((i) => {
    if (i < 0 || i >= row.cells.length) return null;
    return cleanNumericCell(row.cells[i]?.textContent ?? '');
  });
}

function rowStats(values: Array<number | null>): { min: number | null; max: number | null; last: number | null } {
  const defined = values.filter((v): v is number => v !== null && isFinite(v));
  if (defined.length === 0) return { min: null, max: null, last: null };
  return {
    min: Math.min(...defined),
    max: Math.max(...defined),
    last: defined[defined.length - 1],
  };
}

function maxAbsAcross(rowEl: HTMLTableRowElement, indices: number[]): number {
  let max = 0;
  for (const i of indices) {
    const v = cleanNumericCell(rowEl.cells[i]?.textContent ?? '');
    if (v !== null && isFinite(v)) max = Math.max(max, Math.abs(v));
  }
  return max;
}

function computeSharedMax(sequence: VisibleRowEntry[], indices: number[]): number {
  return sequence
    .filter((entry) => entry.state === 'visible')
    .reduce((max, entry) => Math.max(max, maxAbsAcross(entry.rowEl, indices)), 0);
}

const sparklineRenderer: Renderer<SparklineDirective> = {
  kind: 'sparkline',

  headerText() {
    return 'Trend';
  },

  canActivate(_directive, _table, numericColumns) {
    return numericColumns.size >= 3;
  },

  renderHeaderExtras(directive, th) {
    // Drop any previous toggle so re-renders don't accumulate copies.
    const previous = th.querySelector('.gs-vc-scale-toggle');
    if (previous) previous.remove();

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gs-vc-scale-toggle';
    const isShared = directive.scale === 'shared';
    btn.textContent = isShared ? '↕' : '↔';
    btn.setAttribute(
      'aria-label',
      isShared
        ? 'Sparkline scale: shared (click for per-row)'
        : 'Sparkline scale: per-row (click for shared)',
    );
    btn.setAttribute('aria-pressed', String(isShared));
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      mutateDirective(directive.id, {
        scale: isShared ? 'per-row' : 'shared',
      } as Partial<SparklineDirective>);
    });
    th.appendChild(btn);
  },

  renderCell(directive, td, rowEl, sequence, _rowIndex) {
    const indices = getNumericColumnIndices(directive);
    const values = rowValues(rowEl, indices);
    const defined = values.filter((v): v is number => v !== null && isFinite(v));
    if (defined.length === 0) {
      td.textContent = '—';
      td.setAttribute('aria-label', 'no data');
      return;
    }
    const stats = rowStats(values);
    const scaleMax = directive.scale === 'shared'
      ? computeSharedMax(sequence, indices)
      : undefined;
    const svg = buildSparklineSvg(values, undefined, undefined, scaleMax);
    svg.setAttribute('role', 'img');
    const labelParts: string[] = [];
    if (stats.min !== null) labelParts.push(`min ${stats.min}`);
    if (stats.max !== null) labelParts.push(`max ${stats.max}`);
    if (stats.last !== null) labelParts.push(`last ${stats.last}`);
    svg.setAttribute('aria-label', labelParts.join(', ') || 'sparkline');
    td.appendChild(svg);
    td.setAttribute('tabindex', '0');
    td.setAttribute('aria-label', labelParts.join(', ') || 'sparkline');
    wireSparklineCell(directive.tableEl, td, indices);
  },

  onPipelineChange(directive, record, sequence) {
    const indices = getNumericColumnIndices(directive);
    const scaleMax = directive.scale === 'shared'
      ? computeSharedMax(sequence, indices)
      : undefined;
    for (const [rowEl, td] of record.bodyCells) {
      const values = rowValues(rowEl, indices);
      const svg = td.querySelector('svg');
      if (svg instanceof SVGElement) {
        updateSparklineSvg(svg, values, scaleMax);
      }
    }
  },

  onDetach(directive, _record) {
    detachSparklineInteractions(directive.tableEl);
  },

  exporter(directive): VirtualColumnExport {
    const indices = getNumericColumnIndices(directive);
    return {
      headerText: 'Trend',
      getCellText(rowEl) {
        const values = rowValues(rowEl, indices);
        const stats = rowStats(values);
        if (stats.min === null) return '';
        return `min:${stats.min};max:${stats.max};last:${stats.last}`;
      },
    };
  },
};

registerRenderer(sparklineRenderer);

export { sparklineRenderer };
export const sparklineHelpers = { rowValues, rowStats, computeSharedMax };

// Suppress unused-import warning for AppendedColumnRecord — re-exported for tests.
export type { AppendedColumnRecord };
