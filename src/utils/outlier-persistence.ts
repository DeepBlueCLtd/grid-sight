/**
 * `gs.o` URL-fragment + localStorage codec for outlier directives
 * (spec 004-outlier, contracts/url-fragment-schema.md; FR-015/FR-016/FR-017).
 *
 * Grammar:  gs.o = tableId(colKey:threshold;colKey:threshold;),tableId(...)
 *
 * The URL fragment is the source of truth (SC-004 — shareable with no
 * localStorage dependency); `gs:${stem}:outliers` is a same-machine mirror
 * only. Co-exists with `gs.s` (sliders) and `gs.v` (sort+filter): every write
 * preserves the other `&`-separated fragment params. Decoders never throw —
 * malformed input yields the empty state (mirrors `decodeFragment` /
 * `decodeViewState`).
 */

import { urlStem, storageKeyFor } from './slider-persistence';
import type { OutlierThreshold } from '../enrichments/outlier-marks';

/** Decoded form: one entry per table, each a map of colKey → threshold. */
export type PersistedOutlierState = ReadonlyArray<{
  readonly tableId: string;
  readonly columns: ReadonlyMap<string, OutlierThreshold>;
}>;

const URL_PARAM = 'gs.o';
const STORAGE_SUFFIX = 'outliers';
const STORAGE_VERSION = 1;
const COL_KEY_RE = /^[a-z0-9-]+$/;

function isThreshold(n: number): n is OutlierThreshold {
  return n === 1 || n === 2 || n === 3;
}

/* ── Fragment codec ─────────────────────────────────────────────────── */

/** Encode directives into a `gs.o` payload (no leading `gs.o=`). Tables in
 *  input order; columns in the map's iteration order (callers pass column-index
 *  ascending). Empty tables and an empty whole-state collapse to `""`. */
export function encodeOutlierFragment(state: PersistedOutlierState): string {
  const parts: string[] = [];
  for (const t of state) {
    if (!t.tableId) continue;
    const cols: string[] = [];
    for (const [colKey, threshold] of t.columns) {
      if (!COL_KEY_RE.test(colKey)) continue;
      if (!isThreshold(threshold)) continue;
      cols.push(`${colKey}:${threshold}`);
    }
    if (cols.length === 0) continue;
    parts.push(`${t.tableId}(${cols.join(';')};)`);
  }
  return parts.join(',');
}

/** Decode a `gs.o` payload. Never throws; malformed pieces are skipped and
 *  valid siblings survive (FR-017). Out-of-range thresholds and bad colKeys are
 *  dropped; a duplicated colKey in one table is last-wins. */
export function decodeOutlierFragment(raw: string): PersistedOutlierState {
  const out: Array<{ tableId: string; columns: Map<string, OutlierThreshold> }> = [];
  if (!raw) return out;
  try {
    const re = /([^(),]+)\(([^)]*)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      const tableId = m[1].trim();
      if (!tableId) continue;
      const columns = new Map<string, OutlierThreshold>();
      for (const part of m[2].split(';')) {
        const seg = part.trim();
        if (!seg) continue;
        const idx = seg.indexOf(':');
        if (idx <= 0) continue;
        const colKey = seg.slice(0, idx).trim();
        if (!COL_KEY_RE.test(colKey)) continue;
        const t = Number(seg.slice(idx + 1).trim());
        if (!isThreshold(t)) continue;
        columns.set(colKey, t); // last-wins on duplicate colKey
      }
      if (columns.size > 0) out.push({ tableId, columns });
    }
  } catch {
    return [];
  }
  return out;
}

/* ── URL-fragment helpers (preserve other params) ───────────────────── */

function readParam(hash: string): string | undefined {
  if (!hash) return undefined;
  const stripped = hash.startsWith('#') ? hash.slice(1) : hash;
  for (const p of stripped.split('&')) {
    const eq = p.indexOf('=');
    if (eq < 0) continue;
    if (p.slice(0, eq) === URL_PARAM) {
      const v = p.slice(eq + 1);
      try {
        return decodeURIComponent(v);
      } catch {
        return v;
      }
    }
  }
  return undefined;
}

function currentHash(): string {
  return typeof location !== 'undefined' ? location.hash : '';
}

export function readOutliersFromUrl(hash: string = currentHash()): PersistedOutlierState {
  const raw = readParam(hash);
  return raw === undefined ? [] : decodeOutlierFragment(raw);
}

/** Build a new hash with `gs.o` set, preserving every other fragment param.
 *  An empty state removes the `gs.o` segment entirely. */
export function writeOutliersToUrl(
  state: PersistedOutlierState,
  hash: string = currentHash(),
): string {
  const stripped = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = stripped ? stripped.split('&') : [];
  const kept = params.filter((p) => !p.startsWith(`${URL_PARAM}=`));
  const encoded = encodeOutlierFragment(state);
  if (encoded) kept.push(`${URL_PARAM}=${encoded}`);
  return kept.length === 0 ? '' : '#' + kept.join('&');
}

/* ── localStorage mirror ────────────────────────────────────────────── */

export function readOutliersFromStorage(stem?: string): PersistedOutlierState | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(storageKeyFor(STORAGE_SUFFIX, stem));
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return undefined;
    const env = parsed as { version?: unknown; entries?: unknown };
    if (env.version !== STORAGE_VERSION) return undefined;
    if (typeof env.entries !== 'string') return undefined;
    return decodeOutlierFragment(env.entries);
  } catch {
    return undefined;
  }
}

export function writeOutliersToStorage(state: PersistedOutlierState, stem?: string): void {
  if (typeof localStorage === 'undefined') return;
  const key = storageKeyFor(STORAGE_SUFFIX, stem);
  const encoded = encodeOutlierFragment(state);
  if (!encoded) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, entries: encoded }));
  } catch {
    /* ignore quota */
  }
}

/* ── Combined persistence ───────────────────────────────────────────── */

/** Persist directives to BOTH the URL fragment (via `history.replaceState`, no
 *  history entry) and the localStorage mirror. */
export function persistOutliers(state: PersistedOutlierState): void {
  if (typeof history !== 'undefined' && typeof location !== 'undefined') {
    try {
      const newHash = writeOutliersToUrl(state);
      history.replaceState(null, '', location.pathname + location.search + newHash);
    } catch {
      /* ignore */
    }
  }
  writeOutliersToStorage(state);
}

/** Resolve outlier directives on load. Priority: URL (if the `gs.o` segment is
 *  present, even when it decodes empty) > localStorage > empty (SC-004). */
export function resolveInitialOutliers(): PersistedOutlierState {
  if (readParam(currentHash()) !== undefined) return readOutliersFromUrl();
  const ls = readOutliersFromStorage();
  return ls ?? [];
}

/** Re-export so storage/url stems are reachable from one import in tests. */
export { urlStem };
