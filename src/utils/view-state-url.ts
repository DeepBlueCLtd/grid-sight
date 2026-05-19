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

const URL_FRAGMENT_PARAM = 'gs.v';

/* ── Column-key derivation ──────────────────────────────────────────── */

export function colKey(header: HTMLTableCellElement, columnIndex: number): string {
  const text = (header.textContent ?? '').trim().toLowerCase();
  const slug = text.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || `c${columnIndex}`;
}

/** Resolve the colKey for column `i` on `table`, used by sort/filter modules. */
export function colKeyAt(table: HTMLTableElement, columnIndex: number): string {
  const headerRow = table.rows[0];
  if (!headerRow || !headerRow.cells[columnIndex]) return `c${columnIndex}`;
  return colKey(headerRow.cells[columnIndex], columnIndex);
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

/** Split `raw` on top-level commas (commas not inside parens). */
function splitTopLevelSegments(raw: string): string[] {
  const segments: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      segments.push(raw.slice(start, i));
      start = i + 1;
    }
  }
  segments.push(raw.slice(start));
  return segments;
}

function parseSegment(seg: string): TableViewDirective | null {
  const open = seg.indexOf('(');
  const close = seg.lastIndexOf(')');
  if (open <= 0 || close <= open) return null;
  return parseBody(seg.slice(0, open), seg.slice(open + 1, close));
}

/** Decode the raw `gs.v=` value (URL-decoded already). Lenient: malformed
 *  directives are dropped, the rest survive. */
export function decodeViewState(raw: string): TableViewDirective[] {
  if (!raw) return [];
  const out: TableViewDirective[] = [];
  for (const seg of splitTopLevelSegments(raw)) {
    const parsed = parseSegment(seg);
    if (parsed) out.push(parsed);
  }
  return out;
}

function parseBody(tableId: string, body: string): TableViewDirective | null {
  const filters: FilterDirective[] = [];
  let sort: SortDirective | null = null;
  let cursor = 0;

  while (cursor < body.length) {
    if (body.startsWith('f:', cursor)) {
      const end = body.indexOf(';', cursor);
      const clauseEnd = end < 0 ? body.length : end;
      const f = parseFilterClause(body.slice(cursor + 2, clauseEnd));
      if (f) filters.push(f);
      cursor = clauseEnd + 1;
      continue;
    }
    if (body.startsWith('s:', cursor)) {
      sort = parseSortClause(body.slice(cursor + 2));
      break;
    }
    // Unknown marker; bail out lenient.
    break;
  }

  if (!sort && filters.length === 0) return null;
  return { tableId, sort, filters };
}

function parseSortClause(clause: string): SortDirective | null {
  const idx = clause.indexOf(':');
  if (idx < 0) return null;
  const columnKey = clause.slice(0, idx);
  const direction = clause.slice(idx + 1);
  if (!columnKey) return null;
  if (direction !== 'asc' && direction !== 'desc') return null;
  // columnIndex is resolved at hydrate time.
  return { columnIndex: -1, columnKey, direction };
}

function parseFilterClause(clause: string): FilterDirective | null {
  const firstColon = clause.indexOf(':');
  if (firstColon < 0) return null;
  const columnKey = clause.slice(0, firstColon);
  if (!columnKey) return null;
  const rest = clause.slice(firstColon + 1);
  if (rest.startsWith('n:')) return parseNumericFilterBody(columnKey, rest.slice(2));
  if (rest.startsWith('v:')) return parseCategoricalFilterBody(columnKey, rest.slice(2));
  return null;
}

function parseNumericFilterBody(columnKey: string, body: string): FilterDirective | null {
  const parts = body.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  if (parts.length === 3 && parts[2] !== 'h') return null;
  const min = parseOptionalNumber(parts[0]);
  const max = parseOptionalNumber(parts[1]);
  if (min === FAILED || max === FAILED) return null;
  return {
    kind: 'numeric-range',
    columnKey,
    min,
    max,
    hideEmpty: parts.length === 3,
  };
}

const FAILED = Symbol('parse-failed');

function parseOptionalNumber(s: string): number | null | typeof FAILED {
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : FAILED;
}

function parseCategoricalFilterBody(columnKey: string, raw: string): FilterDirective {
  let body = raw;
  let hideEmpty = false;
  if (body.endsWith(':h')) {
    hideEmpty = true;
    body = body.slice(0, -2);
  }
  const values = body === '' ? [] : body.split('|').map(safeDecode);
  return { kind: 'categorical', columnKey, allowed: values, hideEmpty };
}

function safeDecode(v: string): string {
  try { return decodeURIComponent(v); } catch { return v; }
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
