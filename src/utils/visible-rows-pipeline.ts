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
  VisibleRowSequence,
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
  const sourceIndexMap = new Map<HTMLTableRowElement, number>();
  for (let i = 0; i < baseRows.length; i++) {
    dimmedMap.set(baseRows[i], !pass[i]);
    sourceIndexMap.set(baseRows[i], i);
  }
  return renderOrder.map((row) => ({
    row,
    dimmed: dimmedMap.get(row) ?? false,
    sourceIndex: sourceIndexMap.get(row) ?? 0,
  }));
}

export function makeVisibleRowSequence(
  table: HTMLTableElement,
  sort: SortDirective | null,
  comparator: ((a: HTMLTableRowElement, b: HTMLTableRowElement) => number) | null,
  filters: ReadonlyMap<number, FilterPredicate>,
  revision: number
): VisibleRowSequence {
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
