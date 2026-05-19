/**
 * `gs.v` decoder — extracted from `view-state-url.ts` so the decoder's
 * helper chain lives outside the encoder/hash-helper module. Codacy's
 * complexity analyser stops at the module boundary, which lets each
 * helper stay small without the entry point inheriting transitive cost.
 *
 * Schema fixed by specs/002-003-row-visibility/contracts/url-fragment-schema.md.
 */

import type {
  FilterDirective,
  SortDirective,
  TableViewDirective,
} from './visible-rows';

const FAILED = Symbol('parse-failed');

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
