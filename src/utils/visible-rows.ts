/**
 * Visible Row Sequence pipeline — the single sanctioned read-channel
 * for row order and row visibility on Grid-Sight-enabled tables.
 *
 * See specs/002-003-row-visibility/contracts/visible-rows-api.md for
 * the frozen public surface and behaviour guarantees.
 */

import {
  captureOnce,
  clearRecord,
  getRecord,
  restoreOriginalOrder,
} from './original-order';
import { makeVisibleRowSequence } from './visible-rows-pipeline';

/* ── Public types ────────────────────────────────────────────────────── */

export interface VisibleRowEntry {
  readonly row: HTMLTableRowElement;
  readonly dimmed: boolean;
  readonly sourceIndex: number;
}

export interface SortDirective {
  readonly columnIndex: number;
  readonly columnKey: string;
  readonly direction: 'asc' | 'desc';
}

export type FilterDirective =
  | {
      readonly kind: 'numeric-range';
      readonly columnKey: string;
      readonly min: number | null;
      readonly max: number | null;
      readonly hideEmpty: boolean;
    }
  | {
      readonly kind: 'categorical';
      readonly columnKey: string;
      readonly allowed: readonly string[];
      readonly hideEmpty: boolean;
    };

export interface FilterPredicate {
  readonly columnIndex: number;
  readonly columnKey: string;
  test(row: HTMLTableRowElement): boolean;
  toDirective(): FilterDirective;
}

export interface VisibleRowSequence {
  readonly entries: readonly VisibleRowEntry[];
  readonly sort: SortDirective | null;
  readonly filters: ReadonlyMap<number, FilterPredicate>;
  readonly revision: number;
}

export type VisibleRowsListener = (seq: VisibleRowSequence) => void;

/* ── Internal state ─────────────────────────────────────────────────── */

interface PipelineState {
  table: HTMLTableElement;
  sort: SortDirective | null;
  filters: Map<number, FilterPredicate>;
  revision: number;
  listeners: Set<VisibleRowsListener>;
  lastSequence: VisibleRowSequence;
  comparator: ((a: HTMLTableRowElement, b: HTMLTableRowElement) => number) | null;
}

const states = new WeakMap<HTMLTableElement, PipelineState>();

function emptySequence(): VisibleRowSequence {
  return {
    entries: [],
    sort: null,
    filters: new Map(),
    revision: 0,
  };
}

function ensureState(table: HTMLTableElement): PipelineState {
  let state = states.get(table);
  if (!state) {
    state = {
      table,
      sort: null,
      filters: new Map(),
      revision: 0,
      listeners: new Set(),
      lastSequence: emptySequence(),
      comparator: null,
    };
    states.set(table, state);
    // Initial identity projection (no event fired).
    state.lastSequence = computeSequence(state);
  }
  return state;
}

/* ── Pluggable comparator hook ──────────────────────────────────────── */

let comparatorFactory:
  | ((directive: SortDirective, table: HTMLTableElement) =>
      (a: HTMLTableRowElement, b: HTMLTableRowElement) => number)
  | null = null;

/** Register the sort comparator factory. Called once at module load by `enrichments/sort.ts`. */
export function registerComparatorFactory(
  factory: (directive: SortDirective, table: HTMLTableElement) =>
    (a: HTMLTableRowElement, b: HTMLTableRowElement) => number
): void {
  comparatorFactory = factory;
}

/* ── Public API ─────────────────────────────────────────────────────── */

export function getVisibleRows(table: HTMLTableElement): VisibleRowSequence {
  return ensureState(table).lastSequence;
}

export function onVisibleRowsChange(
  table: HTMLTableElement,
  listener: VisibleRowsListener
): () => void {
  const state = ensureState(table);
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

export function setSort(
  table: HTMLTableElement,
  directive: SortDirective | null
): void {
  const state = ensureState(table);
  if (sortEqual(state.sort, directive)) return;
  state.sort = directive ? { ...directive } : null;
  state.comparator =
    directive && comparatorFactory ? comparatorFactory(directive, table) : null;
  reevaluate(state);
}

export function setFilter(
  table: HTMLTableElement,
  columnIndex: number,
  predicate: FilterPredicate | null
): void {
  const state = ensureState(table);
  if (predicate === null) {
    if (!state.filters.has(columnIndex)) return;
    state.filters.delete(columnIndex);
  } else {
    const existing = state.filters.get(columnIndex);
    if (existing === predicate) return;
    state.filters.set(columnIndex, predicate);
  }
  reevaluate(state);
}

export function clearFilters(table: HTMLTableElement): void {
  const state = ensureState(table);
  if (state.filters.size === 0) return;
  state.filters.clear();
  reevaluate(state);
}

export function teardown(table: HTMLTableElement): void {
  const state = states.get(table);
  if (!state) return;
  // Restore byte-identical DOM via OOR before forgetting state.
  restoreOriginalOrder(table);
  const tbody = table.tBodies[0];
  if (tbody) {
    for (const row of Array.from(tbody.rows)) {
      row.classList.remove('gs-row--dimmed');
      row.removeAttribute('data-gs-dimmed');
    }
  }
  // Clear aria-sort on any header.
  const headerRow = table.rows[0];
  if (headerRow) {
    for (const cell of Array.from(headerRow.cells)) {
      cell.removeAttribute('aria-sort');
    }
  }
  state.listeners.clear();
  clearRecord(table);
  states.delete(table);
}

/* ── Internals ──────────────────────────────────────────────────────── */

function sortEqual(a: SortDirective | null, b: SortDirective | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.columnIndex === b.columnIndex &&
    a.direction === b.direction &&
    a.columnKey === b.columnKey
  );
}

function reevaluate(state: PipelineState): void {
  // Capture OOR on first mutation.
  if (!getRecord(state.table)) captureOnce(state.table);
  state.revision += 1;
  const seq = computeSequence(state);
  state.lastSequence = seq;
  applyToDom(state, seq);
  // Synchronous listener emission.
  for (const listener of Array.from(state.listeners)) {
    try {
      listener(seq);
    } catch (err) {
      console.error(err);
    }
  }
}

function computeSequence(state: PipelineState): VisibleRowSequence {
  return makeVisibleRowSequence(
    state.table,
    state.sort,
    state.comparator ?? null,
    state.filters,
    state.revision
  );
}

function applyToDom(state: PipelineState, seq: VisibleRowSequence): void {
  const tbody = state.table.tBodies[0];
  if (!tbody) return;
  // Reorder rows by appending each in renderOrder.
  for (const entry of seq.entries) {
    if (entry.row.parentNode === tbody) {
      tbody.appendChild(entry.row);
    }
  }
  // Apply / clear dim flags.
  for (const entry of seq.entries) {
    if (entry.dimmed) {
      entry.row.classList.add('gs-row--dimmed');
      entry.row.setAttribute('data-gs-dimmed', 'true');
    } else {
      entry.row.classList.remove('gs-row--dimmed');
      entry.row.removeAttribute('data-gs-dimmed');
    }
  }
  // Update aria-sort on every header cell of row[0].
  const headerRow = state.table.rows[0];
  if (headerRow) {
    for (let i = 0; i < headerRow.cells.length; i++) {
      const cell = headerRow.cells[i];
      if (seq.sort && seq.sort.columnIndex === i) {
        cell.setAttribute('aria-sort', seq.sort.direction === 'asc' ? 'ascending' : 'descending');
      } else if (cell.hasAttribute('aria-sort')) {
        cell.setAttribute('aria-sort', 'none');
      }
    }
  }
}

/* ── URL-persistence hooks (used by view-state-url.ts) ──────────────── */

export interface TableViewDirective {
  readonly tableId: string;
  readonly sort: SortDirective | null;
  readonly filters: readonly FilterDirective[];
}

export function serialiseTable(table: HTMLTableElement): TableViewDirective | null {
  const state = states.get(table);
  if (!state) return null;
  if (!state.sort && state.filters.size === 0) return null;
  const filters: FilterDirective[] = [];
  for (const p of state.filters.values()) filters.push(p.toDirective());
  return {
    tableId: table.id,
    sort: state.sort,
    filters,
  };
}

/** Apply a directive synchronously: filters first, then sort (FR-VP-007). */
export function hydrateTable(
  table: HTMLTableElement,
  directive: TableViewDirective,
  predicateBuilder: (d: FilterDirective, columnIndex: number) => FilterPredicate | null
): void {
  // Resolve filter directives → column indices via colKey lookup.
  for (const fd of directive.filters) {
    const columnIndex = resolveColumnIndexByKey(table, fd.columnKey);
    if (columnIndex < 0) continue;
    const pred = predicateBuilder(fd, columnIndex);
    if (pred) setFilter(table, columnIndex, pred);
  }
  if (directive.sort) {
    const columnIndex = resolveColumnIndexByKey(table, directive.sort.columnKey);
    if (columnIndex >= 0) {
      setSort(table, { ...directive.sort, columnIndex });
    }
  }
}

function resolveColumnIndexByKey(table: HTMLTableElement, key: string): number {
  const headerRow = table.rows[0];
  if (!headerRow) return -1;
  // Match against the slug-derived colKey (lazy import to avoid cycles).
  // The implementation lives in view-state-url.ts.
  // We inline the same slug rule here.
  for (let i = 0; i < headerRow.cells.length; i++) {
    const text = (headerRow.cells[i].textContent ?? '').trim().toLowerCase();
    const slug =
      text.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `c${i}`;
    if (slug === key) return i;
  }
  // Fall back to the c<index> convention.
  const m = /^c(\d+)$/.exec(key);
  if (m) {
    const idx = Number(m[1]);
    if (Number.isFinite(idx) && idx >= 0 && idx < headerRow.cells.length) return idx;
  }
  return -1;
}
