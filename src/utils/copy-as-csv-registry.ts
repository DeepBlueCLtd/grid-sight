/**
 * Copy-as-CSV virtual-column registry (spec 012-virtual-columns §R-4).
 * In-memory shim; consumed by 009-copy-as-csv when that feature lands.
 */

import type { VirtualColumnExport } from '../types/virtual-column';

export type { VirtualColumnExport } from '../types/virtual-column';

const tableRegistry = new WeakMap<
  HTMLTableElement,
  Map<string, VirtualColumnExport>
>();

function getOrCreate(table: HTMLTableElement): Map<string, VirtualColumnExport> {
  let m = tableRegistry.get(table);
  if (!m) {
    m = new Map();
    tableRegistry.set(table, m);
  }
  return m;
}

export function registerVirtualColumnForCopy(
  table: HTMLTableElement,
  directiveId: string,
  exporter: VirtualColumnExport,
): void {
  getOrCreate(table).set(directiveId, exporter);
}

export function unregisterVirtualColumnForCopy(
  table: HTMLTableElement,
  directiveId: string,
): void {
  const m = tableRegistry.get(table);
  if (m) m.delete(directiveId);
}

export function listVirtualColumnsForCopy(
  table: HTMLTableElement,
): ReadonlyArray<{ id: string; exporter: VirtualColumnExport }> {
  const m = tableRegistry.get(table);
  if (!m) return [];
  return Array.from(m, ([id, exporter]) => ({ id, exporter }));
}
