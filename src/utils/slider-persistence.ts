/**
 * URL fragment + localStorage round-trip — originally for slider positions,
 * now generalised so the enrichment-toggle persistence (`gs.e`) can share the
 * same encoding, versioning, and stem-derivation rules. See research R-4.
 *
 * Public surface:
 *  - Existing slider-shaped exports (`readFromUrl`, `writeUrlHash`,
 *    `readFromStorage`, `writeToStorage`, `resolveInitialPosition`,
 *    `persistPosition`, `pruneEntry`) keep their signatures byte-identical so
 *    every existing slider call site and test continues to work unchanged.
 *  - New enrichments-shaped exports
 *    (`readEnrichmentsFromUrl`, `writeEnrichmentsToUrl`,
 *    `readEnrichmentsFromStorage`, `writeEnrichmentsToStorage`) layer over the
 *    same generic helpers with `key='gs.e'` / `suffix='enrichments'` and
 *    `entries: string[]`.
 */

const SLIDER_URL_KEY = 'gs.s';
const SLIDER_STORAGE_SUFFIX = 'sliders';
const ENRICHMENTS_URL_KEY = 'gs.e';
const ENRICHMENTS_STORAGE_SUFFIX = 'enrichments';
const STORAGE_VERSION = 1;
const POS_DECIMALS = 5;

export interface PersistedState {
  version: number;
  entries: Record<string, number> | string[];
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

/* ────────────────────────────────────────────────────────────────────────── */
/* Generic URL-fragment helpers                                               */
/* ────────────────────────────────────────────────────────────────────────── */

function readUrlValueForKey(key: string, hash: string): string | undefined {
  if (!hash) return undefined;
  const stripped = hash.startsWith('#') ? hash.slice(1) : hash;
  for (const p of stripped.split('&')) {
    const eq = p.indexOf('=');
    if (eq < 0) continue;
    if (p.slice(0, eq) === key) return decodeURIComponent(p.slice(eq + 1));
  }
  return undefined;
}

function writeUrlValueForKey(key: string, encoded: string, currentHash: string): string {
  const stripped = currentHash.startsWith('#') ? currentHash.slice(1) : currentHash;
  const params = stripped ? stripped.split('&') : [];
  const kept = params.filter(p => !p.startsWith(`${key}=`));
  if (encoded) kept.push(`${key}=${encoded}`);
  return kept.length === 0 ? '' : '#' + kept.join('&');
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Slider-shaped public surface (backwards-compatible)                        */
/* ────────────────────────────────────────────────────────────────────────── */

/** Read slider entries from `location.hash` (or supplied hash). */
export function readFromUrl(
  hash: string = (typeof location !== 'undefined' ? location.hash : '')
): Record<string, number> {
  const raw = readUrlValueForKey(SLIDER_URL_KEY, hash);
  return raw === undefined ? {} : decodeFragment(raw);
}

/** Build a new hash string with the slider entries written to `gs.s=`,
 * preserving any other `&`-separated fragment parameters. */
export function writeUrlHash(
  entries: Record<string, number>,
  currentHash: string = (typeof location !== 'undefined' ? location.hash : '')
): string {
  return writeUrlValueForKey(SLIDER_URL_KEY, encodeFragment(entries), currentHash);
}

function urlStem(): string {
  if (typeof location === 'undefined') return 'default';
  return location.origin + location.pathname;
}

function storageKeyFor(suffix: string, stem: string = urlStem()): string {
  return `gs:${stem}:${suffix}`;
}

function isValidPersistedState(parsed: unknown): parsed is PersistedState {
  if (!parsed || typeof parsed !== 'object') return false;
  const p = parsed as Partial<PersistedState>;
  if (p.version !== STORAGE_VERSION) return false;
  if (Array.isArray(p.entries)) return true;
  if (p.entries && typeof p.entries === 'object') return true;
  return false;
}

function sanitiseSliderEntries(entries: unknown): Record<string, number> {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(entries as Record<string, unknown>)) {
    if (typeof v === 'number' && isFinite(v)) out[k] = clampPos01(v);
  }
  return out;
}

/** Read slider entries from localStorage; returns {} on parse failure or missing key. */
export function readFromStorage(stem?: string): Record<string, number> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(storageKeyFor(SLIDER_STORAGE_SUFFIX, stem));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isValidPersistedState(parsed)) return {};
    return sanitiseSliderEntries(parsed.entries);
  } catch {
    return {};
  }
}

/** Write slider entries to localStorage. Pruning empty state removes the key. */
export function writeToStorage(entries: Record<string, number>, stem?: string): void {
  if (typeof localStorage === 'undefined') return;
  const key = storageKeyFor(SLIDER_STORAGE_SUFFIX, stem);
  if (Object.keys(entries).length === 0) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return;
  }
  const rounded: Record<string, number> = {};
  for (const [k, v] of Object.entries(entries)) {
    rounded[k] = roundPos(v);
  }
  const payload: PersistedState = { version: STORAGE_VERSION, entries: rounded };
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
  const urlEntries = readFromUrl();
  urlEntries[id] = pos01;
  if (typeof history !== 'undefined' && typeof location !== 'undefined') {
    try {
      const newHash = writeUrlHash(urlEntries);
      history.replaceState(null, '', location.pathname + location.search + newHash);
    } catch { /* ignore */ }
  }
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

/* ────────────────────────────────────────────────────────────────────────── */
/* Enrichments-shaped public surface (new in spec 012)                        */
/* ────────────────────────────────────────────────────────────────────────── */

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

function sanitiseEnrichmentList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const trimmed = v.trim().toLowerCase();
    if (ID_PATTERN.test(trimmed)) out.push(trimmed);
  }
  return out;
}

/** Read enrichments from `location.hash` (or supplied hash). Returns
 *  `undefined` when no `gs.e` segment is present (distinct from an empty
 *  segment, which the caller may treat differently). */
export function readEnrichmentsFromUrl(
  hash: string = (typeof location !== 'undefined' ? location.hash : '')
): string[] | undefined {
  const raw = readUrlValueForKey(ENRICHMENTS_URL_KEY, hash);
  if (raw === undefined) return undefined;
  if (raw === '') return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const id = part.trim().toLowerCase();
    if (!ID_PATTERN.test(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Write the enrichments id list to `gs.e=` in a new hash string,
 *  preserving any other `&`-separated fragment parameters. Pass an empty
 *  array to remove the segment. Ids are written in alphabetical order. */
export function writeEnrichmentsToUrl(
  ids: readonly string[],
  currentHash: string = (typeof location !== 'undefined' ? location.hash : '')
): string {
  const sanitised = sanitiseEnrichmentList(ids) ?? [];
  const sorted = sanitised.slice().sort();
  return writeUrlValueForKey(ENRICHMENTS_URL_KEY, sorted.join(','), currentHash);
}

/** Read the enrichments list from localStorage; returns `undefined` when no
 *  key is present (caller falls back to defaults). Returns an empty array
 *  when the key is present with an empty list. */
export function readEnrichmentsFromStorage(stem?: string): string[] | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(storageKeyFor(ENRICHMENTS_STORAGE_SUFFIX, stem));
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidPersistedState(parsed)) return undefined;
    return sanitiseEnrichmentList(parsed.entries) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Write the enrichments id list to localStorage with the versioned wrapper.
 *  Passing an empty array removes the key. */
export function writeEnrichmentsToStorage(ids: readonly string[], stem?: string): void {
  if (typeof localStorage === 'undefined') return;
  const key = storageKeyFor(ENRICHMENTS_STORAGE_SUFFIX, stem);
  const sanitised = sanitiseEnrichmentList(ids) ?? [];
  if (sanitised.length === 0) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return;
  }
  const payload: PersistedState = {
    version: STORAGE_VERSION,
    entries: sanitised.slice().sort(),
  };
  try { localStorage.setItem(key, JSON.stringify(payload)); } catch { /* ignore quota */ }
}

/** Resolve the visitor-persisted enrichments set on init.
 *  Priority: URL > localStorage > `undefined` (resolver falls back to page config). */
export function resolveVisitorEnrichments(): Set<string> | undefined {
  const url = readEnrichmentsFromUrl();
  if (url !== undefined) return new Set(url);
  const ls = readEnrichmentsFromStorage();
  if (ls !== undefined) return new Set(ls);
  return undefined;
}

/** Persist the enrichments set to BOTH the URL fragment and localStorage. */
export function persistVisitorEnrichments(ids: readonly string[]): void {
  if (typeof history !== 'undefined' && typeof location !== 'undefined') {
    try {
      const newHash = writeEnrichmentsToUrl(ids);
      history.replaceState(null, '', location.pathname + location.search + newHash);
    } catch { /* ignore */ }
  }
  writeEnrichmentsToStorage(ids);
}
