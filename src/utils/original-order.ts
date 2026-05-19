/**
 * Original Order Record (OOR) for the row-visibility pipeline.
 *
 * Captures the document-order sequence of <tr> elements in a table's
 * tbody exactly once, at first activation of sort or filter. The record
 * is the means by which we restore byte-identical DOM on teardown
 * (SC-005) and the reference used by `mergeByOriginalIndex`.
 */

export type OriginalOrderRecord = readonly HTMLTableRowElement[];

interface FullRecord {
  rows: readonly HTMLTableRowElement[];
  /** All childNodes of tbody (rows + interleaved text nodes) in original
   *  order. Captured so teardown can byte-identically restore tbody.innerHTML
   *  including whitespace, satisfying SC-005. */
  childNodes: readonly Node[];
}

const records = new WeakMap<HTMLTableElement, FullRecord>();

function tbodyRows(table: HTMLTableElement): readonly HTMLTableRowElement[] {
  const tbody = table.tBodies[0];
  if (!tbody) return [];
  return Array.from(tbody.rows);
}

/** Capture the OOR for this table if it hasn't been captured yet. Idempotent. */
export function captureOnce(table: HTMLTableElement): OriginalOrderRecord {
  const existing = records.get(table);
  if (existing) return existing.rows;
  const tbody = table.tBodies[0];
  const rows = Object.freeze(tbodyRows(table).slice());
  const childNodes = tbody ? Object.freeze(Array.from(tbody.childNodes)) : Object.freeze([]);
  records.set(table, { rows, childNodes });
  return rows;
}

/** Read the current OOR for a table, or `null` if not captured. */
export function getRecord(table: HTMLTableElement): OriginalOrderRecord | null {
  return records.get(table)?.rows ?? null;
}

/** Forget the OOR for a table. Caller is responsible for any DOM restore. */
export function clearRecord(table: HTMLTableElement): void {
  records.delete(table);
}

/** Restore tbody to its OOR order, including interleaved whitespace text
 *  nodes so the serialised innerHTML is byte-identical to capture time
 *  (no-op if no record). */
export function restoreOriginalOrder(table: HTMLTableElement): void {
  const rec = records.get(table);
  if (!rec) return;
  const tbody = table.tBodies[0];
  if (!tbody) return;
  for (const node of rec.childNodes) {
    if (node.parentNode === tbody) tbody.appendChild(node);
  }
}
