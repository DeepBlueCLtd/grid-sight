/**
 * Shared test harness for the table-grid addressing layer (spec 013).
 *
 * Builds the canonical numeric grid (numeric row + column headers + numeric
 * body), captures each author cell's identity, and exposes the activation
 * helpers the unit + composition suites compose in every order.
 */

import { expect } from 'vitest';
import {
  bodyRows,
  gridCells,
  sourceCells,
  sourceColumnCount,
  headerCellFor,
  cellValue,
  logicalRowIndexOf,
} from '../../table-grid';
import { addSlider } from '../../../enrichments/slider';
import { setSort, type SortDirective } from '../../../utils/visible-rows';
import { colKeyAt } from '../../../utils/view-state-url';
import {
  activateDirective,
  getColumnKeys,
  __flushVirtualColumnFrame,
} from '../../../enrichments/virtual-column';
// Side-effect imports: register the sort comparator + virtual-column renderers.
import '../../../enrichments/sort';
import '../../../enrichments/cumulative-column';
import '../../../enrichments/sparkline-column';

export interface CanonicalGrid {
  table: HTMLTableElement;
  /** Number of author source columns (includes the row-header column). */
  sourceCols: number;
  /** Number of author body rows. */
  bodyRowCount: number;
}

/**
 * Build a monotonic numeric grid with a `<thead>` (required by the virtual
 * column scaffold) and numeric row/column headers (required by slider axis
 * binding). Top-left cell is a categorical "GS" label, as in the real demos.
 */
export function buildNumericGrid(): CanonicalGrid {
  const table = document.createElement('table');
  if (!table.id) table.id = `gs-fixture-${Math.random().toString(36).slice(2, 8)}`;
  table.innerHTML = `
    <thead>
      <tr><th>GS</th><th>10</th><th>20</th><th>30</th></tr>
    </thead>
    <tbody>
      <tr><th>1000</th><td>4.2</td><td>5.1</td><td>5.9</td></tr>
      <tr><th>2000</th><td>3.6</td><td>4.4</td><td>5.0</td></tr>
      <tr><th>3000</th><td>3.0</td><td>3.7</td><td>4.2</td></tr>
    </tbody>
  `;
  table.classList.add('grid-sight-enabled');
  document.body.appendChild(table);
  return { table, sourceCols: 4, bodyRowCount: 3 };
}

export interface CapturedIdentity {
  /** `${logicalRowIndex}:${sourceColIndex}` → the author body cell element. */
  cellByRC: Map<string, HTMLTableCellElement>;
  /** Original trimmed text of each author body cell, same key. */
  textByRC: Map<string, string>;
  /** Author header cell per source column index. */
  headerByCol: (HTMLTableCellElement | null)[];
  sourceCols: number;
}

/** Capture each author body + header cell's identity BEFORE any activation. */
export function captureIdentity(table: HTMLTableElement): CapturedIdentity {
  const cols = sourceColumnCount(table);
  const cellByRC = new Map<string, HTMLTableCellElement>();
  const textByRC = new Map<string, string>();
  bodyRows(table).forEach((row, ri) => {
    const cells = sourceCells(row);
    for (let k = 0; k < cols; k++) {
      cellByRC.set(`${ri}:${k}`, cells[k]);
      textByRC.set(`${ri}:${k}`, cellValue(cells[k]));
    }
  });
  const headerByCol: (HTMLTableCellElement | null)[] = [];
  for (let k = 0; k < cols; k++) headerByCol.push(headerCellFor(table, k));
  return { cellByRC, textByRC, headerByCol, sourceCols: cols };
}

/**
 * Assert the addressing layer still resolves every captured author cell after
 * an arbitrary composition of activations: for each current body row, its
 * logical (row, col) source cell is the same element + text captured at
 * baseline, and the header for each source column is unchanged.
 */
export function expectIdentityPreserved(
  table: HTMLTableElement,
  captured: CapturedIdentity,
): void {
  for (const row of bodyRows(table)) {
    const ri = logicalRowIndexOf(table, row);
    const cells = gridCells(row);
    for (let k = 0; k < captured.sourceCols; k++) {
      const key = `${ri}:${k}`;
      expect(cells[k]).toBe(captured.cellByRC.get(key));
      expect(cellValue(cells[k])).toBe(captured.textByRC.get(key));
    }
  }
  for (let k = 0; k < captured.sourceCols; k++) {
    expect(headerCellFor(table, k)).toBe(captured.headerByCol[k]);
  }
}

/* ── Activation helpers ─────────────────────────────────────────────── */

export function enableRowSlider(table: HTMLTableElement): void {
  addSlider(table, 'row');
}

export function enableColSlider(table: HTMLTableElement): void {
  addSlider(table, 'col');
}

/** Add a cumulative virtual column over the given source column index. */
export function addCumulativeColumn(
  table: HTMLTableElement,
  sourceColIndex = 1,
): void {
  const keys = getColumnKeys(table);
  const key = keys[sourceColIndex];
  activateDirective({
    id: `cum-${key}`,
    kind: 'cumulative',
    tableEl: table,
    sourceColKey: key,
    mode: 'sum',
    activationIndex: 0,
  });
  __flushVirtualColumnFrame();
}

export function addSparklineColumn(table: HTMLTableElement): void {
  activateDirective({
    id: 'spark',
    kind: 'sparkline',
    tableEl: table,
    scale: 'per-row',
    style: 'bar',
  });
  __flushVirtualColumnFrame();
}

/** Apply a sort on a logical column (default reverses to exercise INV-5). */
export function applySort(
  table: HTMLTableElement,
  columnIndex = 1,
  direction: 'asc' | 'desc' = 'desc',
): void {
  const directive: SortDirective = {
    columnIndex,
    columnKey: colKeyAt(table, columnIndex),
    direction,
  };
  setSort(table, directive);
}

export type ActivationStep = 'row' | 'col' | 'cumulative' | 'sparkline' | 'sort';

const STEP_FNS: Record<ActivationStep, (t: HTMLTableElement) => void> = {
  row: enableRowSlider,
  col: enableColSlider,
  cumulative: addCumulativeColumn,
  sparkline: addSparklineColumn,
  sort: applySort,
};

/** Run a set of activation steps in a chosen order (for both-permutation testing). */
export function activateInOrder(
  table: HTMLTableElement,
  order: ActivationStep[],
): void {
  for (const step of order) STEP_FNS[step](table);
}
