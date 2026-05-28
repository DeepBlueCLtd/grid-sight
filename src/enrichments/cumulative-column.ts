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
import { sourceCells, headerCellFor, cellValue } from '../core/table-grid';

function getRowValue(row: HTMLTableRowElement, colIndex: number): number | null {
  const cells = sourceCells(row);
  if (colIndex < 0 || colIndex >= cells.length) return null;
  return cleanNumericCell(cellValue(cells[colIndex]));
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

function runningSumOverSequence(
  sequence: VisibleRowEntry[],
  colIndex: number,
  targetRow: HTMLTableRowElement,
): { sum: number; saw: boolean } {
  let sum = 0;
  for (const entry of sequence) {
    if (entry.state !== 'visible') continue;
    const v = getRowValue(entry.rowEl, colIndex);
    if (v !== null) sum += v;
    if (entry.rowEl === targetRow) return { sum, saw: true };
  }
  return { sum, saw: false };
}

function runningSumOverRows(
  rows: HTMLTableRowElement[],
  colIndex: number,
  targetRow: HTMLTableRowElement,
): number {
  let sum = 0;
  for (const r of rows) {
    const v = getRowValue(r, colIndex);
    if (v !== null) sum += v;
    if (r === targetRow) return sum;
  }
  return sum;
}

function computeRunningSumUpTo(
  table: HTMLTableElement,
  targetRow: HTMLTableRowElement,
  colIndex: number,
  sequence: VisibleRowEntry[],
): number {
  if (sequence.length > 0) {
    const { sum, saw } = runningSumOverSequence(sequence, colIndex, targetRow);
    if (saw) return sum;
  }
  // Row not in sequence (e.g. detached, dimmed): fall back to DOM walk.
  const tbody = table.tBodies[0];
  return tbody ? runningSumOverRows(Array.from(tbody.rows), colIndex, targetRow) : 0;
}

function totalForMode(
  table: HTMLTableElement,
  colIndex: number,
  sequence: VisibleRowEntry[],
): number {
  if (sequence.length > 0) return computeTotalFromSequence(sequence, colIndex);
  return computeTotalFromRows(Array.from(table.tBodies[0]?.rows ?? []), colIndex);
}

/* Per-render-pass memo. The scaffold calls renderCell once per row with the
 * same `sequence` array reference, so we compute the running sums + total for
 * a (sequence, column) once in a single O(n) pass and serve O(1) lookups —
 * instead of re-walking the sequence per row (which was O(n²) and, with the
 * addressing-layer per-cell reads, dominated the 1 000-row render budget). */
interface PassSums {
  sums: Map<HTMLTableRowElement, number>;
  total: number;
}
const passCache = new WeakMap<object, Map<number, PassSums>>();

function passSums(sequence: VisibleRowEntry[], colIndex: number): PassSums {
  let byCol = passCache.get(sequence);
  if (!byCol) {
    byCol = new Map();
    passCache.set(sequence, byCol);
  }
  let entry = byCol.get(colIndex);
  if (!entry) {
    const sums = new Map<HTMLTableRowElement, number>();
    let running = 0;
    let total = 0;
    for (const e of sequence) {
      if (e.state !== 'visible') continue;
      const v = getRowValue(e.rowEl, colIndex);
      if (v !== null) {
        running += v;
        total += v;
      }
      sums.set(e.rowEl, running);
    }
    entry = { sums, total };
    byCol.set(colIndex, entry);
  }
  return entry;
}

function writeBlankCell(td: HTMLTableCellElement): void {
  td.textContent = '';
  td.setAttribute('aria-label', 'non-numeric');
}

function writeSumCell(td: HTMLTableCellElement, runningSum: number): void {
  const text = formatNumber(runningSum);
  td.textContent = text;
  td.setAttribute('aria-label', `running sum ${text}`);
}

function writePercentCell(td: HTMLTableCellElement, runningSum: number, total: number): void {
  if (total === 0) {
    td.textContent = '—';
    td.setAttribute('aria-label', 'percent of total: total is zero');
    return;
  }
  const text = formatPercent((runningSum / total) * 100);
  td.textContent = text;
  td.setAttribute('aria-label', `percent of total ${text}`);
}

const cumulativeRenderer: Renderer<CumulativeDirective> = {
  kind: 'cumulative',

  headerText(directive) {
    const colIdx = getColIndex(directive);
    const cell = headerCellFor(directive.tableEl, colIdx);
    // cellValue strips injected lozenge/readout UI, leaving the author label.
    const sourceLabel = (cell ? cellValue(cell) : '') || directive.sourceColKey;
    return `Σ ${sourceLabel}`;
  },

  canActivate(directive, _table, numericColumns) {
    return numericColumns.has(directive.sourceColKey);
  },

  renderCell(directive, td, rowEl, sequence, _rowIndex) {
    const colIdx = getColIndex(directive);
    if (getRowValue(rowEl, colIdx) === null) {
      writeBlankCell(td);
      return;
    }
    // O(1) lookup from the per-pass memo when the row is in the sequence;
    // fall back to a direct walk for rows outside it (e.g. dimmed/detached).
    let runningSum: number;
    let total = 0;
    const cached = sequence.length > 0 ? passSums(sequence, colIdx) : null;
    const memoised = cached?.sums.get(rowEl);
    if (memoised !== undefined) {
      runningSum = memoised;
      total = cached!.total;
    } else {
      runningSum = computeRunningSumUpTo(directive.tableEl, rowEl, colIdx, sequence);
      total = totalForMode(directive.tableEl, colIdx, sequence);
    }
    if (directive.mode === 'sum') {
      writeSumCell(td, runningSum);
    } else {
      writePercentCell(td, runningSum, total);
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
      if (v === null) {
        writeBlankCell(td);
        continue;
      }
      running += v;
      if (directive.mode === 'sum') writeSumCell(td, running);
      else writePercentCell(td, running, total);
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
