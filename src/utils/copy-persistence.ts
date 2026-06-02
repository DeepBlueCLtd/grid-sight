/**
 * `gs.cp` URL-fragment + localStorage codec for the Copy-as-CSV popup config
 * (spec 009-copy-as-csv, FR-017/FR-018/FR-019).
 *
 * Grammar:  gs.cp = fmt:csv;h:1;rh:1;vc:1
 *
 * State is a single PAGE-LEVEL record (the popup configuration is a user
 * preference, not table state). The URL fragment is the source of truth
 * (SC-004 — shareable with no localStorage dependency); `gs:${stem}:copy` is a
 * same-machine mirror only. Every write preserves the other `&`-separated
 * fragment params (co-exists with gs.s / gs.v / gs.o). Decoders never throw —
 * an unknown format falls back to `csv`, an unparseable boolean to `true`.
 */

import { urlStem, storageKeyFor } from './slider-persistence';

export type CopyFormat = 'csv' | 'tsv' | 'md';

export interface CopyOptions {
  format: CopyFormat;
  headers: boolean;
  rowHeaders: boolean;
  virtualCols: boolean;
}

export const DEFAULT_COPY_OPTIONS: CopyOptions = {
  format: 'csv',
  headers: true,
  rowHeaders: true,
  virtualCols: true,
};

const URL_PARAM = 'gs.cp';
const STORAGE_SUFFIX = 'copy';
const STORAGE_VERSION = 1;
const FORMATS: readonly CopyFormat[] = ['csv', 'tsv', 'md'];

function isFormat(v: string): v is CopyFormat {
  return (FORMATS as readonly string[]).includes(v);
}

/* ── Fragment codec ─────────────────────────────────────────────────── */

/** Encode options into a `gs.cp` payload (no leading `gs.cp=`). */
export function encodeCopyFragment(opts: CopyOptions): string {
  const fmt = isFormat(opts.format) ? opts.format : 'csv';
  const b = (x: boolean) => (x ? '1' : '0');
  return `fmt:${fmt};h:${b(opts.headers)};rh:${b(opts.rowHeaders)};vc:${b(opts.virtualCols)}`;
}

/** Decode a `gs.cp` payload. Never throws; unknown format → csv, unparseable
 *  boolean → its `true` default (FR-019). */
export function decodeCopyFragment(raw: string): CopyOptions {
  const out: CopyOptions = { ...DEFAULT_COPY_OPTIONS };
  if (!raw) return out;
  try {
    for (const part of raw.split(';')) {
      const seg = part.trim();
      if (!seg) continue;
      const idx = seg.indexOf(':');
      if (idx <= 0) continue;
      const key = seg.slice(0, idx).trim();
      const val = seg.slice(idx + 1).trim();
      switch (key) {
        case 'fmt':
          out.format = isFormat(val) ? val : 'csv';
          break;
        case 'h':
          out.headers = parseBool(val, true);
          break;
        case 'rh':
          out.rowHeaders = parseBool(val, true);
          break;
        case 'vc':
          out.virtualCols = parseBool(val, true);
          break;
        default:
          break;
      }
    }
  } catch {
    return { ...DEFAULT_COPY_OPTIONS };
  }
  return out;
}

function parseBool(v: string, fallback: boolean): boolean {
  if (v === '1' || v === 'true') return true;
  if (v === '0' || v === 'false') return false;
  return fallback;
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

export function readCopyFromUrl(hash: string = currentHash()): CopyOptions | undefined {
  const raw = readParam(hash);
  return raw === undefined ? undefined : decodeCopyFragment(raw);
}

/** Build a new hash with `gs.cp` set, preserving every other fragment param. */
export function writeCopyToUrl(opts: CopyOptions, hash: string = currentHash()): string {
  const stripped = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = stripped ? stripped.split('&') : [];
  const kept = params.filter((p) => !p.startsWith(`${URL_PARAM}=`));
  kept.push(`${URL_PARAM}=${encodeCopyFragment(opts)}`);
  return '#' + kept.join('&');
}

/* ── localStorage mirror ────────────────────────────────────────────── */

export function readCopyFromStorage(stem?: string): CopyOptions | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(storageKeyFor(STORAGE_SUFFIX, stem));
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return undefined;
    const env = parsed as { version?: unknown; payload?: unknown };
    if (env.version !== STORAGE_VERSION) return undefined;
    if (typeof env.payload !== 'string') return undefined;
    return decodeCopyFragment(env.payload);
  } catch {
    return undefined;
  }
}

export function writeCopyToStorage(opts: CopyOptions, stem?: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      storageKeyFor(STORAGE_SUFFIX, stem),
      JSON.stringify({ version: STORAGE_VERSION, payload: encodeCopyFragment(opts) }),
    );
  } catch {
    /* ignore quota */
  }
}

/* ── Combined persistence ───────────────────────────────────────────── */

/** Persist options to BOTH the URL fragment (via `history.replaceState`, no
 *  history entry) and the localStorage mirror. */
export function persistCopyConfig(opts: CopyOptions): void {
  if (typeof history !== 'undefined' && typeof location !== 'undefined') {
    try {
      const newHash = writeCopyToUrl(opts);
      history.replaceState(null, '', location.pathname + location.search + newHash);
    } catch {
      /* ignore */
    }
  }
  writeCopyToStorage(opts);
}

/** Resolve the popup config on open. Priority: URL > localStorage > defaults. */
export function resolveInitialCopyConfig(): CopyOptions {
  return readCopyFromUrl() ?? readCopyFromStorage() ?? { ...DEFAULT_COPY_OPTIONS };
}

/** Re-export so storage/url stems are reachable from one import in tests. */
export { urlStem };
