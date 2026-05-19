/**
 * Per-table column-types cache, keyed by table element.
 *
 * Invariant: only `processTable` (the function that legitimately detects
 * column types from cell content) writes the cache via `setColumnTypes`.
 * Other callers (e.g. the toggle-panel refresh path) read via
 * `getColumnTypes` and treat an undefined return as a cache miss.
 *
 * Lifetime is bounded by the table element: when the host removes the
 * table from the DOM and drops references, the WeakMap entry is collected.
 * `clearColumnTypes(table)` exists for explicit invalidation from
 * `gridSight.disable()`.
 */

import type { ColumnType } from './type-detection';

const cache = new WeakMap<HTMLTableElement, ColumnType[]>();

export function getColumnTypes(table: HTMLTableElement): ColumnType[] | undefined {
  return cache.get(table);
}

export function setColumnTypes(table: HTMLTableElement, types: ColumnType[]): void {
  cache.set(table, types.slice());
}

export function clearColumnTypes(table: HTMLTableElement): void {
  cache.delete(table);
}
