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
import { registerRenderer, getNumericColumns, getColumnKeys } from './virtual-column';
import { buildSparklineSvg, updateSparklineSvg } from './sparkline-svg';

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

function computeSharedMax(sequence: VisibleRowEntry[], indices: number[]): number {
  let max = 0;
  for (const entry of sequence) {
    if (entry.state !== 'visible') continue;
    for (const i of indices) {
      const v = cleanNumericCell(entry.rowEl.cells[i]?.textContent ?? '');
      if (v !== null && isFinite(v)) max = Math.max(max, Math.abs(v));
    }
  }
  return max;
}

const sparklineRenderer: Renderer<SparklineDirective> = {
  kind: 'sparkline',

  headerText() {
    return 'Trend';
  },

  canActivate(_directive, _table, numericColumns) {
    return numericColumns.size >= 3;
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
