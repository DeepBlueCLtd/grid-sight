/**
 * Outlier enrichment orchestrator (spec 004-outlier).
 *
 * Owns the per-table runtime state (a `WeakMap` of active directives + their
 * computed marks), the registry lifecycle hooks (`applyOutliers`/
 * `tearDownOutliers`), the click entry point (`setOutlierThreshold`), the
 * lozenge/popup read probes (`getOutlierThreshold`/`getOutlierMarks`), and the
 * filter-aware live recompute (subscribes `onVisibleRowsChange` while any
 * column on the table is active — research R-3).
 *
 * Pure mark math lives in `outlier-marks.ts`; the shared mean/σ in
 * `core/column-statistics.ts`; persistence in `utils/outlier-persistence.ts`.
 * This module wires them to the DOM and the URL.
 */

import {
  computeColumnStatistics,
  columnNumericEntries,
} from '../core/column-statistics';
import {
  computeMarks,
  formatOutlierTooltip,
  type OutlierThreshold,
  type OutlierMark,
} from './outlier-marks';
import { ensureOutlierStyles, removeOutlierStyles } from './outlier-styles';
import { attachOutlierTooltip } from '../ui/outlier-tooltip';
import { closeAllOutlierPopups } from '../ui/outlier-popup';
import {
  resolveInitialOutliers,
  persistOutliers,
  type PersistedOutlierState,
} from '../utils/outlier-persistence';
import { colKeyAt } from '../utils/view-state-url';
import { gridColumnCount, columnCells } from '../core/table-grid';
import { onVisibleRowsChange } from '../utils/visible-rows';

// Re-export the shared types so consumers import from one place (data-model §5).
export type { OutlierThreshold, OutlierMark } from './outlier-marks';

/** A `(table, column, threshold)` tuple — at most one active per column. */
export interface OutlierDirective {
  readonly tableId: string;
  readonly columnKey: string;
  readonly columnIndex: number;
  readonly threshold: OutlierThreshold;
}

interface OutlierTableState {
  /** Active directive per columnKey (idle columns absent). */
  readonly directives: Map<string, OutlierDirective>;
  /** Current marks per columnKey, for the popup + recompute. */
  readonly marks: Map<string, OutlierMark[]>;
  /** Per-columnKey list of per-cell unpaint closures (class/attr/tooltip). */
  readonly unpaint: Map<string, Array<() => void>>;
  /** Unsubscribe handle for onVisibleRowsChange; null when no column active. */
  unsubscribeVisibleRows: (() => void) | null;
}

const MARKER_CLASS = 'gs-outlier-cell';
const DATA_SIGMA = 'data-gs-outlier';
const DATA_OWN_TABINDEX = 'data-gs-outlier-tabindex';

const states = new WeakMap<HTMLTableElement, OutlierTableState>();
/** Tables with live outlier state — enumerable (WeakMap is not) so we can
 *  serialise the whole page on every change and tidy the stylesheet on the
 *  last teardown. */
const activeTables = new Set<HTMLTableElement>();

function ensureTableState(table: HTMLTableElement): OutlierTableState {
  let st = states.get(table);
  if (!st) {
    st = {
      directives: new Map(),
      marks: new Map(),
      unpaint: new Map(),
      unsubscribeVisibleRows: null,
    };
    states.set(table, st);
  }
  activeTables.add(table);
  return st;
}

/* ── Read probes (lozenge refresh + popup) ──────────────────────────── */

/** Current active threshold for a column, or null (idle). */
export function getOutlierThreshold(
  table: HTMLTableElement,
  columnIndex: number,
): OutlierThreshold | null {
  const st = states.get(table);
  if (!st) return null;
  return st.directives.get(colKeyAt(table, columnIndex))?.threshold ?? null;
}

/** Current marks for a column (for the list popup). */
export function getOutlierMarks(
  table: HTMLTableElement,
  columnIndex: number,
): readonly OutlierMark[] {
  const st = states.get(table);
  if (!st) return [];
  return st.marks.get(colKeyAt(table, columnIndex)) ?? [];
}

/* ── Qualification gates ────────────────────────────────────────────── */

/** ≥ 3 numeric body cells (FR-010). Used by the header `appliesTo` gate.
 *  σ = 0 columns still qualify (the lozenge renders but is inert — FR-009). */
export function qualifiesForOutliers(table: HTMLTableElement, columnIndex: number): boolean {
  return computeColumnStatistics(table, columnIndex).numericCount >= 3;
}

/** True when the column's current (filter-scoped) σ is exactly 0 — the lozenge
 *  renders but clicking is a no-op (FR-009). */
export function isColumnInert(table: HTMLTableElement, columnIndex: number): boolean {
  return computeColumnStatistics(table, columnIndex, { excludeDimmed: true }).stdDev === 0;
}

/** Restore gate: a column is activatable only if it has ≥ 3 numeric cells, no
 *  rowspan body cell, and a non-zero σ (FR-017 — skip non-qualifying on load). */
function canActivate(table: HTMLTableElement, columnIndex: number): boolean {
  if (columnIndex < 0) return false;
  if (columnCells(table, columnIndex).some((c) => c.rowSpan > 1)) return false;
  const stats = computeColumnStatistics(table, columnIndex);
  return stats.numericCount >= 3 && Number.isFinite(stats.stdDev) && stats.stdDev !== 0;
}

/* ── Click entry point ──────────────────────────────────────────────── */

/** Set/clear the active threshold for one column; persists `gs.o` and repaints. */
export function setOutlierThreshold(
  table: HTMLTableElement,
  columnIndex: number,
  threshold: OutlierThreshold | null,
): void {
  applyThreshold(table, columnIndex, threshold, true);
}

function applyThreshold(
  table: HTMLTableElement,
  columnIndex: number,
  threshold: OutlierThreshold | null,
  persist: boolean,
): void {
  const st = ensureTableState(table);
  const key = colKeyAt(table, columnIndex);
  if (threshold === null) {
    st.directives.delete(key);
    unpaintColumn(st, key);
    st.marks.delete(key);
  } else {
    st.directives.set(key, {
      tableId: table.id,
      columnKey: key,
      columnIndex,
      threshold,
    });
    repaintColumn(table, st, columnIndex, key, threshold);
  }
  updateSubscription(table, st);
  if (persist) persistOutliers(serialiseAll());
}

/* ── Lifecycle hooks (registry apply/tearDown) ──────────────────────── */

/** Registry apply hook: render persisted directives from `gs.o` for this table.
 *  Idempotent and re-runnable after `tearDownOutliers` (enable→disable→enable).
 *  Does NOT write back to the URL. */
export function applyOutliers(table: HTMLTableElement): void {
  if (!table.id) return;
  const persisted = resolveInitialOutliers();
  for (const entry of persisted) {
    if (entry.tableId !== table.id) continue;
    for (const [colKey, threshold] of entry.columns) {
      const columnIndex = resolveColIndex(table, colKey);
      if (!canActivate(table, columnIndex)) continue; // missing/non-qualifying → skip (FR-017)
      applyThreshold(table, columnIndex, threshold, false);
    }
  }
}

/** Registry tearDown hook: remove ALL markers/tooltips and any open popup,
 *  unsubscribe the filter listener. DOM byte-identical to pre-flagging
 *  (FR-021, SC-005). Does NOT touch `gs.o`. */
export function tearDownOutliers(table: HTMLTableElement): void {
  const st = states.get(table);
  if (!st) return;
  for (const key of Array.from(st.unpaint.keys())) unpaintColumn(st, key);
  if (st.unsubscribeVisibleRows) {
    st.unsubscribeVisibleRows();
    st.unsubscribeVisibleRows = null;
  }
  st.directives.clear();
  st.marks.clear();
  states.delete(table);
  activeTables.delete(table);
  closeAllOutlierPopups();
  if (activeTables.size === 0) removeOutlierStyles();
}

/* ── Marker paint / unpaint ─────────────────────────────────────────── */

function repaintColumn(
  table: HTMLTableElement,
  st: OutlierTableState,
  columnIndex: number,
  key: string,
  threshold: OutlierThreshold,
): void {
  unpaintColumn(st, key);
  ensureOutlierStyles();
  const entries = columnNumericEntries(table, columnIndex, { excludeDimmed: true });
  const stats = computeColumnStatistics(table, columnIndex, { excludeDimmed: true });
  const marks = computeMarks(entries, stats, threshold);
  st.marks.set(key, marks);
  const detachers: Array<() => void> = [];
  for (const mark of marks) detachers.push(paintCell(mark, stats.mean));
  st.unpaint.set(key, detachers);
}

function paintCell(mark: OutlierMark, mean: number): () => void {
  const cell = mark.cell;
  cell.classList.add(MARKER_CLASS);
  cell.setAttribute(DATA_SIGMA, signedSigma(mark.sigmaDistance));
  // Make the cell focusable so the tooltip is keyboard-reachable (FR-019).
  // Track whether WE added tabindex so teardown can leave author values intact.
  const ownedTabindex = !cell.hasAttribute('tabindex');
  if (ownedTabindex) {
    cell.setAttribute('tabindex', '0');
    cell.setAttribute(DATA_OWN_TABINDEX, '');
  }
  const detachTooltip = attachOutlierTooltip(cell, formatOutlierTooltip(mark, mean));
  return () => {
    cell.classList.remove(MARKER_CLASS);
    cell.removeAttribute(DATA_SIGMA);
    if (cell.hasAttribute(DATA_OWN_TABINDEX)) {
      cell.removeAttribute('tabindex');
      cell.removeAttribute(DATA_OWN_TABINDEX);
    }
    detachTooltip();
    // Drop the class attribute entirely if it is now empty (byte-identical DOM).
    if (cell.getAttribute('class') === '') cell.removeAttribute('class');
  };
}

function unpaintColumn(st: OutlierTableState, key: string): void {
  const detachers = st.unpaint.get(key);
  if (!detachers) return;
  for (const d of detachers) d();
  st.unpaint.delete(key);
}

function signedSigma(sigma: number): string {
  return `${sigma >= 0 ? '+' : '-'}${Math.abs(sigma).toFixed(1)}`;
}

/* ── Filter-aware live recompute (research R-3) ─────────────────────── */

function updateSubscription(table: HTMLTableElement, st: OutlierTableState): void {
  const anyActive = st.directives.size > 0;
  if (anyActive && !st.unsubscribeVisibleRows) {
    st.unsubscribeVisibleRows = onVisibleRowsChange(table, () => recomputeActive(table, st));
  } else if (!anyActive && st.unsubscribeVisibleRows) {
    st.unsubscribeVisibleRows();
    st.unsubscribeVisibleRows = null;
  }
}

/** Recompute + repaint every active column over the current un-dimmed set.
 *  Sort emits this too, but marks ride their cells so the set is unchanged;
 *  only a filter change to the un-dimmed rows alters which cells qualify. */
function recomputeActive(table: HTMLTableElement, st: OutlierTableState): void {
  for (const dir of Array.from(st.directives.values())) {
    repaintColumn(table, st, dir.columnIndex, dir.columnKey, dir.threshold);
  }
}

/* ── Persistence helpers ────────────────────────────────────────────── */

function resolveColIndex(table: HTMLTableElement, colKey: string): number {
  const n = gridColumnCount(table);
  for (let i = 0; i < n; i++) {
    if (colKeyAt(table, i) === colKey) return i;
  }
  return -1;
}

/** Serialise every table's active directives into a `PersistedOutlierState`.
 *  Tables in document order; columns within a table in column-index order so
 *  the same view always produces the same `gs.o` string. */
function serialiseAll(): PersistedOutlierState {
  const tables = Array.from(activeTables).filter(
    (t) => typeof t.isConnected !== 'boolean' || t.isConnected,
  );
  tables.sort(documentOrder);
  const out: Array<{ tableId: string; columns: Map<string, OutlierThreshold> }> = [];
  for (const t of tables) {
    const st = states.get(t);
    if (!st || st.directives.size === 0 || !t.id) continue;
    const ordered = Array.from(st.directives.values()).sort(
      (a, b) => a.columnIndex - b.columnIndex,
    );
    const columns = new Map<string, OutlierThreshold>();
    for (const d of ordered) columns.set(d.columnKey, d.threshold);
    out.push({ tableId: t.id, columns });
  }
  return out;
}

function documentOrder(a: HTMLTableElement, b: HTMLTableElement): number {
  if (a === b) return 0;
  const pos = a.compareDocumentPosition(b);
  if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}
