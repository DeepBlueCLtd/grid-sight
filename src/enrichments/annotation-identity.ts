/**
 * Cell-identity derivation for annotations (spec 006, research R-2).
 *
 * Every annotation is keyed by a load-time-stable `(tableKey, rowKey,
 * columnKey)` triple derived from the source DOM — never from post-sort
 * visual position — so notes follow their source cell across sort/filter
 * (FR-010, FR-011). The triple is memoised per cell via a `WeakMap` so later
 * reorder passes never recompute it from shifted positions.
 */

import { colKeyAt } from '../utils/view-state-url';
import { getDataRows } from '../utils/original-order';

export interface CellIdentity {
  readonly tableKey: string;
  readonly rowKey: string;
  readonly columnKey: string;
}

const SEGMENT = /^[a-z0-9-]+$/;

const identityCache = new WeakMap<HTMLTableCellElement, CellIdentity>();
const tableKeyCache = new WeakMap<HTMLTableElement, string>();

// One console.warn per page on an index-fallback table key (FR-013).
let warnedIndexFallback = false;

/** Test-only: reset the per-page index-fallback warning latch. */
export function __resetIdentityWarnings(): void {
  warnedIndexFallback = false;
}

function slug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function tableIndex(table: HTMLTableElement): number {
  if (typeof document === 'undefined') return 0;
  const all = Array.from(document.querySelectorAll('table'));
  const i = all.indexOf(table);
  return i < 0 ? 0 : i;
}

function deriveTableKey(table: HTMLTableElement, warn: boolean): string {
  const cached = tableKeyCache.get(table);
  if (cached) return cached;

  const explicit = table.getAttribute('data-gs-key');
  let key: string | null = null;
  if (explicit && slug(explicit)) {
    key = slug(explicit);
  } else if (table.id && slug(table.id)) {
    key = slug(table.id);
  } else {
    const caption = table.caption?.textContent ?? '';
    const captionSlug = slug(caption);
    if (captionSlug) key = captionSlug;
  }

  if (!key) {
    key = `t${tableIndex(table)}`;
    if (warn && !warnedIndexFallback) {
      warnedIndexFallback = true;
      console.warn(
        '[gridsight] annotations: a table has no data-gs-key, id, or <caption>; ' +
          'falling back to a document-order key. Annotations on such tables are ' +
          'fragile if the source HTML is later edited. Add a data-gs-key to make them robust.'
      );
    }
  }

  tableKeyCache.set(table, key);
  return key;
}

function rowFirstCellText(row: HTMLTableRowElement): string {
  const cells = Array.from(row.cells);
  const headerCell = cells.find(
    (c) => c.tagName === 'TH' && c.getAttribute('scope') === 'row'
  );
  const first = headerCell ?? cells[0];
  return first ? first.textContent ?? '' : '';
}

function deriveRowKey(
  row: HTMLTableRowElement,
  dataRows: readonly HTMLTableRowElement[]
): string {
  const explicit = row.getAttribute('data-gs-row-key');
  if (explicit && slug(explicit)) return slug(explicit);
  const textSlug = slug(rowFirstCellText(row));
  if (textSlug) return textSlug;
  const idx = dataRows.indexOf(row);
  return `r${idx < 0 ? 0 : idx}`;
}

/** Derive (and memoise) the load-time-stable identity triple for a body cell. */
export function cellIdentity(cell: HTMLTableCellElement): CellIdentity {
  const cached = identityCache.get(cell);
  if (cached) return cached;

  const row = cell.parentElement as HTMLTableRowElement | null;
  const table = cell.closest('table') as HTMLTableElement | null;
  const tableKey = table ? deriveTableKey(table, true) : 't0';
  const dataRows = table ? getDataRows(table) : [];
  const rowKey = row ? deriveRowKey(row, dataRows) : 'r0';
  const columnKey = table ? colKeyAt(table, cell.cellIndex) : `c${cell.cellIndex}`;

  const identity: CellIdentity = { tableKey, rowKey, columnKey };
  identityCache.set(cell, identity);
  return identity;
}

/** Canonical map-key string `tableKey/rowKey/columnKey`. */
export function identityKey(id: CellIdentity): string {
  return `${id.tableKey}/${id.rowKey}/${id.columnKey}`;
}

/** Parse an identityKey string back into a CellIdentity, or null if malformed. */
export function parseIdentityKey(key: string): CellIdentity | null {
  const parts = key.split('/');
  if (parts.length !== 3) return null;
  const [tableKey, rowKey, columnKey] = parts;
  if (!SEGMENT.test(tableKey) || !SEGMENT.test(rowKey) || !SEGMENT.test(columnKey)) {
    return null;
  }
  return { tableKey, rowKey, columnKey };
}

/** True when the table or the cell opts out via data-gs-ignore /
 *  data-gs-no-annotate (FR-012). */
export function isOptedOut(cell: HTMLTableCellElement): boolean {
  if (cell.hasAttribute('data-gs-no-annotate') || cell.hasAttribute('data-gs-ignore')) {
    return true;
  }
  const table = cell.closest('table');
  if (
    table &&
    (table.hasAttribute('data-gs-no-annotate') || table.hasAttribute('data-gs-ignore'))
  ) {
    return true;
  }
  return false;
}

/** Resolve a live body cell for an identity triple, or null if the
 *  table/row/column no longer exists (FR-016). */
export function resolveCell(id: CellIdentity): HTMLTableCellElement | null {
  if (typeof document === 'undefined') return null;
  for (const table of Array.from(document.querySelectorAll('table'))) {
    if (deriveTableKey(table, false) !== id.tableKey) continue;
    const dataRows = getDataRows(table);
    for (const row of dataRows) {
      if (deriveRowKey(row, dataRows) !== id.rowKey) continue;
      for (const cell of Array.from(row.cells)) {
        if (cell.hasAttribute('data-gs-injected')) continue;
        if (colKeyAt(table, cell.cellIndex) === id.columnKey) {
          return cell as HTMLTableCellElement;
        }
      }
    }
  }
  return null;
}
