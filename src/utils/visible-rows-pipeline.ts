/**
 * Pure helpers that the visible-rows pipeline composes to project base
 * rows into a `VisibleRowSequence`. Extracted from `visible-rows.ts` so
 * Codacy's complexity analyser bounds each function to this module.
 */

import { getRecord } from './original-order';
import type {
  FilterPredicate,
  SortDirective,
  VisibleRowEntry,
} from './visible-rows';

export function getBaseRows(table: HTMLTableElement): readonly HTMLTableRowElement[] {
  const oor = getRecord(table);
  if (oor) return oor;
  const tbody = table.tBodies[0];
  return tbody ? Array.from(tbody.rows) : [];
}

function safeTest(predicate: FilterPredicate, row: HTMLTableRowElement): boolean {
  try { return predicate.test(row); } catch { return true; }
}

export function computePassFlags(
  baseRows: readonly HTMLTableRowElement[],
  filters: ReadonlyMap<number, FilterPredicate>
): boolean[] {
  const filtersArr = Array.from(filters.values());
  return baseRows.map((row) => filtersArr.every((p) => safeTest(p, row)));
}

export function mergeByOriginalIndex(
  baseRows: readonly HTMLTableRowElement[],
  pass: readonly boolean[],
  comparator: (a: HTMLTableRowElement, b: HTMLTableRowElement) => number
): HTMLTableRowElement[] {
  const visible = baseRows.filter((_, i) => pass[i]);
  visible.sort(comparator);
  const out: HTMLTableRowElement[] = new Array(baseRows.length);
  let vIdx = 0;
  for (let i = 0; i < baseRows.length; i++) {
    out[i] = pass[i] ? visible[vIdx++] : baseRows[i];
  }
  return out;
}

export function buildEntries(
  baseRows: readonly HTMLTableRowElement[],
  renderOrder: readonly HTMLTableRowElement[],
  pass: readonly boolean[]
): VisibleRowEntry[] {
  const dimmedMap = new Map<HTMLTableRowElement, boolean>();
  for (let i = 0; i < baseRows.length; i++) {
    dimmedMap.set(baseRows[i], !pass[i]);
  }
  return renderOrder.map((rowEl) => ({
    rowEl,
    state: dimmedMap.get(rowEl) ? 'dimmed' as const : 'visible' as const,
  }));
}

/** Snapshot of the pipeline projection without the live subscription methods.
 *  `visible-rows.ts` wraps this with `current()` + `subscribe()` to satisfy
 *  the `VisibleRowSubscription` part of `VisibleRowSequence`. */
export interface VisibleRowSnapshot {
  entries: VisibleRowEntry[];
  sort: SortDirective | null;
  filters: ReadonlyMap<number, FilterPredicate>;
  revision: number;
}

export function makeVisibleRowSnapshot(
  table: HTMLTableElement,
  sort: SortDirective | null,
  comparator: ((a: HTMLTableRowElement, b: HTMLTableRowElement) => number) | null,
  filters: ReadonlyMap<number, FilterPredicate>,
  revision: number
): VisibleRowSnapshot {
  const baseRows = getBaseRows(table);
  const pass = computePassFlags(baseRows, filters);
  const renderOrder = sort && comparator
    ? mergeByOriginalIndex(baseRows, pass, comparator)
    : baseRows.slice();
  return {
    entries: buildEntries(baseRows, renderOrder, pass),
    sort,
    filters: new Map(filters),
    revision,
  };
}
