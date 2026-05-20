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

/**
 * Return the data rows of `table` — every `<tr>` inside `tbody` EXCEPT a
 * de-facto header row that the browser promoted into the implicit tbody
 * when the markup lacked an explicit `<thead>`. Required because the
 * slider demos and many real-world legacy tables use `<tr><th>…</th></tr>`
 * directly under `<table>`; without this guard the row-visibility pipeline
 * sorts the header along with the data rows.
 *
 * Header detection: `table.rows[0]` is the de-facto header iff
 *  (a) it sits inside the same tbody we're about to read AND
 *  (b) it contains at least one `<th>` cell.
 * If `<thead>` is present, row 0 lives there and the tbody starts at the
 * data rows already, so no skip is needed.
 */
export function getDataRows(table: HTMLTableElement): readonly HTMLTableRowElement[] {
  const tbody = table.tBodies[0];
  if (!tbody) return [];
  const all = Array.from(tbody.rows);
  if (all.length === 0) return all;
  const headerRow = table.rows[0];
  if (
    headerRow &&
    headerRow === all[0] &&
    Array.from(headerRow.cells).some((c) => c.tagName === 'TH')
  ) {
    return all.slice(1);
  }
  return all;
}

/** Capture the OOR for this table if it hasn't been captured yet. Idempotent. */
export function captureOnce(table: HTMLTableElement): OriginalOrderRecord {
  const existing = records.get(table);
  if (existing) return existing.rows;
  const tbody = table.tBodies[0];
  const rows = Object.freeze(getDataRows(table).slice());
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
