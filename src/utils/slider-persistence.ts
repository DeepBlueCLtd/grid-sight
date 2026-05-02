/**
 * URL fragment + localStorage round-trip for slider positions.
 * See specs/001-dynamic-sliders/research.md §R-5 and data-model.md.
 */

const URL_FRAGMENT_PARAM = 'gs.s';
const STORAGE_VERSION = 1;
const POS_DECIMALS = 5;

export interface PersistedState {
  version: number;
  entries: Record<string, number>;
}

function clampPos01(v: number): number {
  if (!isFinite(v)) return 0.5;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function roundPos(v: number): number {
  const factor = 10 ** POS_DECIMALS;
  return Math.round(clampPos01(v) * factor) / factor;
}

/** Encode `entries` into a fragment string of the shape `id:pos,id:pos,...`. */
export function encodeFragment(entries: Record<string, number>): string {
  const parts: string[] = [];
  for (const [id, pos] of Object.entries(entries)) {
    if (!/^[a-zA-Z0-9_.#-]+$/.test(id)) continue;
    parts.push(`${id}:${roundPos(pos)}`);
  }
  return parts.length === 0 ? '' : parts.join(',');
}

/** Parse the fragment value (right-hand side of `gs.s=`) into entries.
 * Malformed fragments yield an empty object. */
export function decodeFragment(raw: string): Record<string, number> {
  const result: Record<string, number> = {};
  if (!raw) return result;
  for (const part of raw.split(',')) {
    const idx = part.lastIndexOf(':');
    if (idx <= 0) continue;
    const id = part.slice(0, idx);
    const posText = part.slice(idx + 1);
    if (!/^[a-zA-Z0-9_.#-]+$/.test(id)) continue;
    const pos = parseFloat(posText);
    if (!isFinite(pos)) continue;
    result[id] = clampPos01(pos);
  }
  return result;
}

/** Read all slider entries from `location.hash`. */
export function readFromUrl(hash: string = (typeof location !== 'undefined' ? location.hash : '')): Record<string, number> {
  if (!hash) return {};
  const stripped = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = stripped.split('&');
  for (const p of params) {
    const eq = p.indexOf('=');
    if (eq < 0) continue;
    const k = p.slice(0, eq);
    const v = p.slice(eq + 1);
    if (k === URL_FRAGMENT_PARAM) return decodeFragment(decodeURIComponent(v));
  }
  return {};
}

/** Build a new hash string with the slider entries written to `gs.s=`,
 * preserving any other `&`-separated fragment parameters. */
export function writeUrlHash(entries: Record<string, number>, currentHash: string = (typeof location !== 'undefined' ? location.hash : '')): string {
  const stripped = currentHash.startsWith('#') ? currentHash.slice(1) : currentHash;
  const params = stripped ? stripped.split('&') : [];
  const kept = params.filter(p => !p.startsWith(`${URL_FRAGMENT_PARAM}=`));
  const encoded = encodeFragment(entries);
  if (encoded) kept.push(`${URL_FRAGMENT_PARAM}=${encoded}`);
  return kept.length === 0 ? '' : '#' + kept.join('&');
}

function urlStem(): string {
  if (typeof location === 'undefined') return 'default';
  return location.origin + location.pathname;
}

function storageKey(stem: string = urlStem()): string {
  return `gs:${stem}:sliders`;
}

function isValidPersistedState(parsed: unknown): parsed is PersistedState {
  if (!parsed || typeof parsed !== 'object') return false;
  const p = parsed as Partial<PersistedState>;
  return p.version === STORAGE_VERSION && typeof p.entries === 'object' && p.entries !== null;
}

function sanitiseStoredEntries(entries: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(entries)) {
    if (typeof v === 'number' && isFinite(v)) out[k] = clampPos01(v);
  }
  return out;
}

/** Read entries from localStorage; returns {} on parse failure or missing key. */
export function readFromStorage(stem?: string): Record<string, number> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(storageKey(stem));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isValidPersistedState(parsed)) return {};
    return sanitiseStoredEntries(parsed.entries);
  } catch {
    return {};
  }
}

/** Write entries to localStorage. Pruning empty state removes the key. */
export function writeToStorage(entries: Record<string, number>, stem?: string): void {
  if (typeof localStorage === 'undefined') return;
  const key = storageKey(stem);
  if (Object.keys(entries).length === 0) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return;
  }
  const payload: PersistedState = { version: STORAGE_VERSION, entries: {} };
  for (const [k, v] of Object.entries(entries)) {
    payload.entries[k] = roundPos(v);
  }
  try { localStorage.setItem(key, JSON.stringify(payload)); } catch { /* ignore quota */ }
}

/** Resolve the initial position for a single slider id.
 *  Priority: URL > localStorage > 0.5 (midpoint). */
export function resolveInitialPosition(id: string): number {
  const url = readFromUrl();
  if (id in url) return url[id];
  const ls = readFromStorage();
  if (id in ls) return ls[id];
  return 0.5;
}

/** Persist a single slider's position to BOTH the URL fragment and localStorage. */
export function persistPosition(id: string, pos01: number): void {
  // URL
  const urlEntries = readFromUrl();
  urlEntries[id] = pos01;
  if (typeof history !== 'undefined' && typeof location !== 'undefined') {
    try {
      const newHash = writeUrlHash(urlEntries);
      history.replaceState(null, '', location.pathname + location.search + newHash);
    } catch { /* ignore */ }
  }
  // localStorage
  const ls = readFromStorage();
  ls[id] = pos01;
  writeToStorage(ls);
}

/** Remove a single slider id from both URL and localStorage. */
export function pruneEntry(id: string): void {
  const urlEntries = readFromUrl();
  const filteredUrl: Record<string, number> = {};
  for (const [k, v] of Object.entries(urlEntries)) {
    if (k !== id) filteredUrl[k] = v;
  }
  if (typeof history !== 'undefined' && typeof location !== 'undefined') {
    try {
      const newHash = writeUrlHash(filteredUrl);
      history.replaceState(null, '', location.pathname + location.search + newHash);
    } catch { /* ignore */ }
  }
  const ls = readFromStorage();
  const filteredLs: Record<string, number> = {};
  for (const [k, v] of Object.entries(ls)) {
    if (k !== id) filteredLs[k] = v;
  }
  writeToStorage(filteredLs);
}
