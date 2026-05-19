/**
 * Cumulative virtual column renderer (spec 012-virtual-columns US1).
 * Σ <header> with sum and percent-of-total modes.
 */

import type {
  CumulativeDirective,
  Renderer,
  VirtualColumnExport,
  VisibleRowEntry,
} from '../types/virtual-column';
import { cleanNumericCell } from '../core/type-detection';
import { registerRenderer, getSourceColumnIndex } from './virtual-column';

function getRowValue(row: HTMLTableRowElement, colIndex: number): number | null {
  if (colIndex < 0 || colIndex >= row.cells.length) return null;
  const text = row.cells[colIndex]?.textContent ?? '';
  return cleanNumericCell(text);
}

function getColIndex(directive: CumulativeDirective): number {
  return getSourceColumnIndex(directive.tableEl, directive.sourceColKey);
}

function formatNumber(n: number): string {
  // Up to 4 fractional digits, trimming trailing zeros.
  if (!isFinite(n)) return '—';
  if (Math.abs(n) >= 1e6 || (n !== 0 && Math.abs(n) < 1e-3)) {
    return n.toPrecision(6);
  }
  return parseFloat(n.toFixed(4)).toString();
}

function formatPercent(p: number): string {
  if (!isFinite(p)) return '—';
  return `${parseFloat(p.toFixed(2))}%`;
}

function computeTotalFromSequence(sequence: VisibleRowEntry[], colIndex: number): number {
  let total = 0;
  for (const entry of sequence) {
    if (entry.state !== 'visible') continue;
    const v = getRowValue(entry.rowEl, colIndex);
    if (v !== null) total += v;
  }
  return total;
}

function computeTotalFromRows(rows: HTMLTableRowElement[], colIndex: number): number {
  let total = 0;
  for (const row of rows) {
    const v = getRowValue(row, colIndex);
    if (v !== null) total += v;
  }
  return total;
}

const cumulativeRenderer: Renderer<CumulativeDirective> = {
  kind: 'cumulative',

  headerText(directive) {
    const head = directive.tableEl.tHead?.rows[0];
    const colIdx = getColIndex(directive);
    const cell = head?.cells[colIdx];
    // Use only text nodes (skip lozenge button text).
    let sourceLabel = '';
    if (cell) {
      cell.childNodes.forEach((n) => {
        if (n.nodeType === 3) sourceLabel += n.textContent;
      });
      sourceLabel = sourceLabel.trim();
    }
    if (!sourceLabel) sourceLabel = directive.sourceColKey;
    return `Σ ${sourceLabel}`;
  },

  canActivate(directive, _table, numericColumns) {
    return numericColumns.has(directive.sourceColKey);
  },

  renderCell(directive, td, rowEl, sequence, _rowIndex) {
    const colIdx = getColIndex(directive);
    // Compute partial accumulator up to and including this row in the supplied sequence.
    const targetRow = rowEl;
    let runningSum = 0;
    let saw = false;
    if (sequence.length > 0) {
      for (const entry of sequence) {
        if (entry.state !== 'visible') continue;
        const v = getRowValue(entry.rowEl, colIdx);
        if (v !== null) runningSum += v;
        if (entry.rowEl === targetRow) {
          saw = true;
          break;
        }
      }
    }
    if (!saw) {
      // Row not in sequence (e.g. detached, dimmed); fall back to DOM walk.
      const tbody = directive.tableEl.tBodies[0];
      if (tbody) {
        runningSum = 0;
        for (const r of Array.from(tbody.rows)) {
          const v = getRowValue(r, colIdx);
          if (v !== null) runningSum += v;
          if (r === targetRow) {
            saw = true;
            break;
          }
        }
      }
    }

    const cellValue = getRowValue(rowEl, colIdx);
    if (cellValue === null) {
      td.textContent = '';
      td.setAttribute('aria-label', 'non-numeric');
      return;
    }

    if (directive.mode === 'sum') {
      td.textContent = formatNumber(runningSum);
      td.setAttribute('aria-label', `running sum ${formatNumber(runningSum)}`);
    } else {
      // percent-of-total
      const total = sequence.length > 0
        ? computeTotalFromSequence(sequence, colIdx)
        : computeTotalFromRows(Array.from(directive.tableEl.tBodies[0]?.rows ?? []), colIdx);
      if (total === 0) {
        td.textContent = '—';
        td.setAttribute('aria-label', 'percent of total: total is zero');
      } else {
        const pct = (runningSum / total) * 100;
        td.textContent = formatPercent(pct);
        td.setAttribute('aria-label', `percent of total ${formatPercent(pct)}`);
      }
    }
  },

  onPipelineChange(directive, record, sequence) {
    const colIdx = getColIndex(directive);
    let running = 0;
    const total =
      directive.mode === 'percent'
        ? computeTotalFromSequence(sequence, colIdx)
        : 0;
    for (const entry of sequence) {
      if (entry.state === 'hidden') continue;
      const td = record.bodyCells.get(entry.rowEl);
      if (!td) continue;
      const v = entry.state === 'visible' ? getRowValue(entry.rowEl, colIdx) : null;
      if (v !== null && entry.state === 'visible') running += v;
      if (v === null) {
        td.textContent = '';
        td.setAttribute('aria-label', 'non-numeric');
        continue;
      }
      if (directive.mode === 'sum') {
        td.textContent = formatNumber(running);
        td.setAttribute('aria-label', `running sum ${formatNumber(running)}`);
      } else {
        if (total === 0) {
          td.textContent = '—';
        } else {
          const pct = (running / total) * 100;
          td.textContent = formatPercent(pct);
        }
      }
    }
  },

  exporter(directive): VirtualColumnExport {
    const colIdx = getColIndex(directive);
    const tbody = directive.tableEl.tBodies[0];
    const orderedRows: HTMLTableRowElement[] = tbody ? Array.from(tbody.rows) : [];
    return {
      headerText: cumulativeRenderer.headerText(directive),
      getCellText(rowEl) {
        const v = getRowValue(rowEl, colIdx);
        if (v === null) return '';
        let running = 0;
        for (const r of orderedRows) {
          const rv = getRowValue(r, colIdx);
          if (rv !== null) running += rv;
          if (r === rowEl) {
            if (directive.mode === 'sum') return formatNumber(running);
            const total = orderedRows.reduce((acc, rr) => {
              const x = getRowValue(rr, colIdx);
              return acc + (x ?? 0);
            }, 0);
            if (total === 0) return '';
            return formatPercent((running / total) * 100);
          }
        }
        return '';
      },
    };
  },
};

registerRenderer(cumulativeRenderer);

export { cumulativeRenderer };
// Aliases for tests
export const cumulativeMath = {
  formatNumber,
  formatPercent,
  computeTotalFromSequence,
  computeTotalFromRows,
};
// Re-export the cell-text helper used by US1 unit tests:
export function getCellTextForCumulative(directive: CumulativeDirective, rowEl: HTMLTableRowElement): string {
  return cumulativeRenderer.exporter(directive).getCellText(rowEl);
}
