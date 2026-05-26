/**
 * Per-document localStorage codec for annotations (spec 006, R-3).
 *
 * Schema and caps fixed by contracts/localstorage-schema.md: one key per
 * document, `gs:${origin+pathname}:annotations`, holding a versioned envelope
 * `{ version:1, title?, entries:{ <AnnotationKey>: { t, m } } }`. Reuses the
 * `gs:` prefix and per-URL-stem derivation from slider-persistence.ts but with
 * a distinct `annotations` suffix and payload shape (free text + timestamp).
 *
 * All access is wrapped in try/catch so persistence never throws into the host
 * page (constitution §IV). Read does NOT resolve against the DOM — the caller
 * drops missing/opted-out targets.
 */

import { storageKeyFor } from '../utils/slider-persistence';
import type { CellIdentity } from './annotation-identity';
import { identityKey, parseIdentityKey } from './annotation-identity';

const VERSION = 1;
const SUFFIX = 'annotations';
const MAX_LEN = 280;

export interface AnnotationRecord {
  id: CellIdentity;
  text: string;
  modifiedAt: number;
}

interface StoredEntry {
  t: string;
  m: number;
}

interface Envelope {
  version: number;
  title?: string;
  entries: Record<string, StoredEntry>;
}

/** True for a genuine storage-quota exception (storage works but is full), as
 *  opposed to storage being blocked/unavailable (private mode, sandboxed
 *  iframe, disabled). Evergreen browsers throw a named DOMException for quota;
 *  anything else is treated as unavailable so the save degrades to session-only
 *  rather than showing a misleading "storage is full" error (FR-017). */
function isQuotaError(e: unknown): boolean {
  return (
    typeof DOMException !== 'undefined' &&
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 ||
      e.code === 1014)
  );
}

/** True when localStorage is readable/writable in this context. */
export function isStorageAvailable(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const probe = '__gs_annot_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** Read the current document's annotations from localStorage. Returns [] on
 *  missing/malformed/legacy envelopes or when storage is unavailable. */
export function readDocumentAnnotations(): AnnotationRecord[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKeyFor(SUFFIX));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return [];
    const env = parsed as Partial<Envelope>;
    if (env.version !== VERSION) return [];
    const entries = env.entries;
    if (!entries || typeof entries !== 'object') return [];

    const out: AnnotationRecord[] = [];
    for (const [key, value] of Object.entries(entries)) {
      const id = parseIdentityKey(key);
      if (!id) continue;
      if (!value || typeof value !== 'object') continue;
      const entry = value as Partial<StoredEntry>;
      if (typeof entry.t !== 'string') continue;
      const text = entry.t.slice(0, MAX_LEN);
      if (!text) continue;
      const modifiedAt =
        typeof entry.m === 'number' && isFinite(entry.m) ? entry.m : Date.now();
      out.push({ id, text, modifiedAt });
    }
    return out;
  } catch {
    return [];
  }
}

/** Write the document's annotations to localStorage (version:1 envelope with
 *  document.title). Empty input removes the key. */
export function writeDocumentAnnotations(
  entries: readonly AnnotationRecord[]
): { ok: true } | { ok: false; reason: 'quota' | 'unavailable' } {
  if (typeof localStorage === 'undefined') return { ok: false, reason: 'unavailable' };
  let key: string;
  try {
    key = storageKeyFor(SUFFIX);
  } catch {
    return { ok: false, reason: 'unavailable' };
  }

  if (entries.length === 0) {
    try {
      localStorage.removeItem(key);
      return { ok: true };
    } catch {
      return { ok: false, reason: 'unavailable' };
    }
  }

  const envelope: Envelope = {
    version: VERSION,
    entries: {},
  };
  const title = typeof document !== 'undefined' ? document.title : '';
  if (title) envelope.title = title;
  for (const e of entries) {
    envelope.entries[identityKey(e.id)] = {
      t: e.text.slice(0, MAX_LEN),
      m: e.modifiedAt,
    };
  }

  try {
    localStorage.setItem(key, JSON.stringify(envelope));
    return { ok: true };
  } catch (e) {
    // Genuine quota → refuse-and-warn (FR-017). Blocked/unavailable storage →
    // degrade to session-only so the in-memory note is still allowed.
    return { ok: false, reason: isQuotaError(e) ? 'quota' : 'unavailable' };
  }
}
