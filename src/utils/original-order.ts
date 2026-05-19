/**
 * Original Order Record (OOR) for the row-visibility pipeline.
 *
 * Captures the document-order sequence of <tr> elements in a table's
 * tbody exactly once, at first activation of sort or filter. The record
 * is the means by which we restore byte-identical DOM on teardown
 * (SC-005) and the reference used by `mergeByOriginalIndex`.
 */

export type OriginalOrderRecord = readonly HTMLTableRowElement[];

const records = new WeakMap<HTMLTableElement, OriginalOrderRecord>();

function tbodyRows(table: HTMLTableElement): readonly HTMLTableRowElement[] {
  const tbody = table.tBodies[0];
  if (!tbody) return [];
  return Array.from(tbody.rows);
}

/** Capture the OOR for this table if it hasn't been captured yet. Idempotent. */
export function captureOnce(table: HTMLTableElement): OriginalOrderRecord {
  const existing = records.get(table);
  if (existing) return existing;
  const snapshot: OriginalOrderRecord = Object.freeze(tbodyRows(table).slice());
  records.set(table, snapshot);
  return snapshot;
}

/** Read the current OOR for a table, or `null` if not captured. */
export function getRecord(table: HTMLTableElement): OriginalOrderRecord | null {
  return records.get(table) ?? null;
}

/** Forget the OOR for a table. Caller is responsible for any DOM restore. */
export function clearRecord(table: HTMLTableElement): void {
  records.delete(table);
}

/** Restore tbody to its OOR order (no-op if no record). */
export function restoreOriginalOrder(table: HTMLTableElement): void {
  const oor = records.get(table);
  if (!oor) return;
  const tbody = table.tBodies[0];
  if (!tbody) return;
  for (const row of oor) {
    if (row.parentNode === tbody) tbody.appendChild(row);
  }
}
