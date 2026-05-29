/**
 * Combined sort + filter URL-fragment codec (`gs.v`).
 *
 * Schema and behaviour fixed by
 * specs/002-003-row-visibility/contracts/url-fragment-schema.md.
 *
 * Co-exists with `gs.s` (slider-persistence.ts) in `location.hash`;
 * each parameter writes back preserving all the others.
 */

import type {
  FilterDirective,
  SortDirective,
  TableViewDirective,
} from './visible-rows';
import { decodeViewState } from './view-state-decode';
import { headerRow, gridCells, cellValue } from '../core/table-grid';
export { decodeViewState };

const URL_FRAGMENT_PARAM = 'gs.v';

/* ── Column-key derivation ──────────────────────────────────────────── */

export function colKey(header: HTMLTableCellElement, columnIndex: number): string {
  // Use the canonical author-text reader (strips GS-injected lozenge clusters)
  // so the key is stable whether or not enrichment affordances are mounted, and
  // does not drift as a lozenge glyph changes (e.g. the outlier `!` → `!2`).
  const text = cellValue(header).toLowerCase();
  const slug = text.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || `c${columnIndex}`;
}

/** Resolve the colKey for column `i` on `table`, used by sort/filter modules.
 *  Slider-injected rows/cells (`data-gs-injected`) are skipped so `columnIndex`
 *  means the same thing whether or not a slider is active. */
export function colKeyAt(table: HTMLTableElement, columnIndex: number): string {
  const head = headerRow(table);
  const cells = head ? gridCells(head) : [];
  if (!cells[columnIndex]) return `c${columnIndex}`;
  return colKey(cells[columnIndex], columnIndex);
}

/* ── Codec ──────────────────────────────────────────────────────────── */

/** Encode an ordered list of table directives into a `gs.v` payload (no leading `gs.v=`). */
export function encodeViewState(perTable: readonly TableViewDirective[]): string {
  const parts: string[] = [];
  for (const t of perTable) {
    if (!t.tableId) continue;
    if (!t.sort && t.filters.length === 0) continue;
    const body: string[] = [];
    for (const f of t.filters) body.push(encodeFilter(f));
    if (t.sort) body.push(encodeSort(t.sort));
    parts.push(`${t.tableId}(${body.join('')})`);
  }
  return parts.join(',');
}

function encodeSort(s: SortDirective): string {
  return `s:${s.columnKey}:${s.direction}`;
}

function encodeFilter(f: FilterDirective): string {
  if (f.kind === 'numeric-range') {
    const min = f.min === null ? '' : String(f.min);
    const max = f.max === null ? '' : String(f.max);
    const hide = f.hideEmpty ? ':h' : '';
    return `f:${f.columnKey}:n:${min}:${max}${hide};`;
  }
  // categorical
  const values = f.allowed.map((v) => encodeURIComponent(v)).join('|');
  const hide = f.hideEmpty ? ':h' : '';
  return `f:${f.columnKey}:v:${values}${hide};`;
}

/* ── Fragment-parameter helpers (preserve other params) ─────────────── */

export function readViewStateFromHash(
  hash: string = typeof location !== 'undefined' ? location.hash : ''
): TableViewDirective[] {
  if (!hash) return [];
  const stripped = hash.startsWith('#') ? hash.slice(1) : hash;
  for (const p of stripped.split('&')) {
    const eq = p.indexOf('=');
    if (eq < 0) continue;
    const k = p.slice(0, eq);
    const v = p.slice(eq + 1);
    if (k === URL_FRAGMENT_PARAM) {
      try {
        return decodeViewState(decodeURIComponent(v));
      } catch {
        return [];
      }
    }
  }
  return [];
}

export function writeViewStateToHash(
  perTable: readonly TableViewDirective[],
  currentHash: string = typeof location !== 'undefined' ? location.hash : ''
): string {
  const stripped = currentHash.startsWith('#') ? currentHash.slice(1) : currentHash;
  const params = stripped ? stripped.split('&') : [];
  const kept = params.filter((p) => !p.startsWith(`${URL_FRAGMENT_PARAM}=`));
  const encoded = encodeViewState(perTable);
  if (encoded) kept.push(`${URL_FRAGMENT_PARAM}=${encoded}`);
  return kept.length === 0 ? '' : '#' + kept.join('&');
}

/** Replace the browser hash without polluting history. */
export function commitViewStateToLocation(perTable: readonly TableViewDirective[]): void {
  if (typeof history === 'undefined' || typeof location === 'undefined') return;
  try {
    const newHash = writeViewStateToHash(perTable);
    history.replaceState(null, '', location.pathname + location.search + newHash);
  } catch {
    /* ignore */
  }
}
