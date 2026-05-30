/**
 * Annotations orchestration (spec 006). Owns the in-memory AnnotationStore for
 * the current document and mediates between the persistence codec, the cell
 * identity triple, and the affordance/marker UI.
 *
 * Lifecycle:
 *  - applyAnnotations(table): hydrate from localStorage (once), mount the pin
 *    affordance on every qualifying body cell, and paint surviving markers
 *    within one animation frame (FR-015, SC-002). Subscribes to visible-rows
 *    changes so markers follow their source cell across sort/filter (SC-004).
 *  - saveAnnotation / deleteAnnotation / getAnnotation: mutate the store and
 *    re-write the document envelope (quota refuse-and-warn — FR-017).
 *  - tearDownAnnotations(table): restore byte-identical DOM; leaves
 *    localStorage intact so toggle-on re-hydrates.
 */

import { ensureAnnotationStyles } from './annotation-styles';
import {
  cellIdentity,
  identityKey,
  isOptedOut,
  resolveCell,
  parseIdentityKey,
} from './annotation-identity';
import type { CellIdentity } from './annotation-identity';
import {
  readDocumentAnnotations,
  writeDocumentAnnotations,
  isStorageAvailable,
} from './annotation-persistence';
import type { AnnotationRecord } from './annotation-persistence';
import {
  mountAffordance,
  renderMarker,
  clearMarker,
  pulseMarker,
  removeAffordance,
} from '../ui/annotation-affordance';
import { openAnnotationPopover } from '../ui/annotation-popover';
import { registerAnnotationsMenuEntry } from '../ui/annotation-popup';
import { isEnrichmentEnabled } from '../core/enabled-set-state';
import { onVisibleRowsChange } from '../utils/visible-rows';
import { getDataRows } from '../utils/original-order';

const MAX_LEN = 280;

interface Annotation {
  identity: CellIdentity;
  text: string;
  modifiedAt: number;
}
type AnnotationStore = Map<string, Annotation>;

let store: AnnotationStore | null = null;
let hydrated = false;
let storageWarned = false;
const subscribedTables = new WeakSet<HTMLTableElement>();

function ensureStore(): AnnotationStore {
  if (!store) store = new Map();
  return store;
}

/** Test-only: reset the module's in-memory state. */
export function __resetAnnotations(): void {
  store = null;
  hydrated = false;
  storageWarned = false;
}

function warnSessionOnly(): void {
  if (storageWarned) return;
  storageWarned = true;
  console.warn(
    '[gridsight] annotations: localStorage is unavailable; notes will not persist (session-only).'
  );
}

function hydrateOnce(): void {
  if (hydrated) return;
  hydrated = true;
  const s = ensureStore();
  if (!isStorageAvailable()) {
    warnSessionOnly();
    return;
  }
  for (const rec of readDocumentAnnotations()) {
    const cell = resolveCell(rec.id);
    if (!cell) continue; // missing table/row/column (FR-016)
    if (isOptedOut(cell)) continue; // opted-out target (FR-012)
    s.set(identityKey(rec.id), {
      identity: rec.id,
      text: rec.text,
      modifiedAt: rec.modifiedAt,
    });
  }
}

function persist(): { ok: true } | { ok: false; reason: 'quota' | 'unavailable' } {
  const s = ensureStore();
  const entries: AnnotationRecord[] = Array.from(s.values()).map((a) => ({
    id: a.identity,
    text: a.text,
    modifiedAt: a.modifiedAt,
  }));
  const r = writeDocumentAnnotations(entries);
  if (!r.ok && r.reason === 'unavailable') warnSessionOnly();
  return r;
}

function bodyCells(table: HTMLTableElement): HTMLTableCellElement[] {
  const out: HTMLTableCellElement[] = [];
  for (const row of getDataRows(table)) {
    for (const cell of Array.from(row.cells)) {
      if (cell.hasAttribute('data-gs-injected')) continue;
      out.push(cell as HTMLTableCellElement);
    }
  }
  return out;
}

function renderMarkersForTable(table: HTMLTableElement): void {
  const s = ensureStore();
  for (const cell of bodyCells(table)) {
    if (isOptedOut(cell)) continue;
    const a = s.get(identityKey(cellIdentity(cell)));
    if (a) renderMarker(cell, a.text);
  }
}

/** Apply annotations to a table when Grid-Sight is enabled and the
 *  `annotations` enrichment is in the effective enabled set. Idempotent. */
export function applyAnnotations(table: HTMLTableElement): void {
  // Spec 015: gate is table-scoped — a per-table config can withhold
  // annotations from this specific table.
  if (!isEnrichmentEnabled('annotations', table)) return;
  ensureAnnotationStyles();
  hydrateOnce();

  const cells = bodyCells(table);
  // Compute (and memoise) identities from the clean load-time DOM BEFORE
  // mounting pins, so the pin glyph never pollutes a first-cell row key.
  for (const cell of cells) {
    if (isOptedOut(cell)) continue;
    cellIdentity(cell);
  }
  for (const cell of cells) {
    if (isOptedOut(cell)) continue;
    mountAffordance(cell, openAnnotationPopover);
  }

  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => renderMarkersForTable(table));
  } else {
    renderMarkersForTable(table);
  }

  // Re-attach markers after sort/filter reorders or rebuilds rows (SC-004).
  if (!subscribedTables.has(table)) {
    subscribedTables.add(table);
    try {
      onVisibleRowsChange(table, () => renderMarkersForTable(table));
    } catch {
      /* ignore — table without the row-visibility pipeline */
    }
  }
}

/** Upsert a note for `cell`. Empty/whitespace text deletes. */
export function saveAnnotation(
  cell: HTMLTableCellElement,
  text: string
): { ok: true } | { ok: false; reason: 'quota' } {
  hydrateOnce();
  const s = ensureStore();
  const id = cellIdentity(cell);
  const key = identityKey(id);
  const value = text.trim().slice(0, MAX_LEN);

  if (!value) {
    if (s.has(key)) {
      s.delete(key);
      clearMarker(cell);
      persist();
      refreshMenuEntry();
    }
    return { ok: true };
  }

  const prev = s.get(key);
  s.set(key, { identity: id, text: value, modifiedAt: Date.now() });
  const r = persist();
  if (!r.ok && r.reason === 'quota') {
    // Refuse: restore the prior store state; the prior stored value is retained.
    if (prev) s.set(key, prev);
    else s.delete(key);
    return { ok: false, reason: 'quota' };
  }
  renderMarker(cell, value);
  refreshMenuEntry();
  return { ok: true };
}

/** Delete the note for `cell` (if any). */
export function deleteAnnotation(cell: HTMLTableCellElement): void {
  hydrateOnce();
  const s = ensureStore();
  const key = identityKey(cellIdentity(cell));
  if (!s.has(key)) return;
  s.delete(key);
  clearMarker(cell);
  persist();
  refreshMenuEntry();
}

// Keep the "Show annotations" entry in sync after the first save / last delete
// so it appears/disappears live without a reload (FR-020).
function refreshMenuEntry(): void {
  try {
    registerAnnotationsMenuEntry();
  } catch {
    /* ignore */
  }
}

/** Current note text for a cell, or undefined. */
export function getAnnotation(cell: HTMLTableCellElement): string | undefined {
  hydrateOnce();
  return ensureStore().get(identityKey(cellIdentity(cell)))?.text;
}

/** Whether localStorage holds ≥ 1 annotation for the current origin (FR-020). */
export function hasAnyAnnotationsForOrigin(): boolean {
  if (typeof localStorage !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !/^gs:.*:annotations$/.test(k)) continue;
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        try {
          const env = JSON.parse(raw) as { version?: number; entries?: object };
          if (env && env.version === 1 && env.entries && Object.keys(env.entries).length > 0) {
            return true;
          }
        } catch {
          /* skip malformed */
        }
      }
    } catch {
      /* ignore */
    }
  }
  return (store?.size ?? 0) > 0;
}

function clearNavigationHint(parts: string[]): void {
  if (typeof history === 'undefined' || typeof location === 'undefined') return;
  const kept = parts.filter((p) => !p.startsWith('gs.annot='));
  const newHash = kept.length === 0 ? '' : '#' + kept.join('&');
  try {
    history.replaceState(null, '', location.pathname + location.search + newHash);
  } catch {
    /* ignore */
  }
}

/** Consume a transient `#gs.annot=<key>` navigation hint (FR-019, FR-021). */
export function consumeNavigationHint(): void {
  if (typeof location === 'undefined') return;
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
  if (!hash) return;
  const parts = hash.split('&');
  const hintPart = parts.find((p) => p.startsWith('gs.annot='));
  if (!hintPart) return;

  const hintKey = decodeURIComponent(hintPart.slice('gs.annot='.length));
  const id = parseIdentityKey(hintKey);
  if (id) {
    const cell = resolveCell(id);
    if (cell) {
      try {
        cell.scrollIntoView({ block: 'center' });
      } catch {
        /* ignore */
      }
      // Pulse on the next frame so the hydrated marker (rendered in its own
      // requestAnimationFrame) already exists when we add the pulse class.
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => pulseMarker(cell));
      } else {
        pulseMarker(cell);
      }
    }
  }
  clearNavigationHint(parts);
}

/** Registry tearDown: remove every annotation affordance, marker,
 *  aria-describedby node, and the relative-positioning shim from `table`.
 *  Restores byte-identical DOM. Does NOT clear localStorage. */
export function tearDownAnnotations(table: HTMLTableElement): void {
  for (const cell of bodyCells(table)) {
    removeAffordance(cell);
  }
  if (typeof document !== 'undefined') {
    document
      .querySelectorAll('.gs-annotation-popover, .gs-annotation-popup')
      .forEach((el) => el.remove());
  }
}
