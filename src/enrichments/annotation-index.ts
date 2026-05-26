/**
 * Cross-document annotation index (spec 006, R-8). Scans localStorage for every
 * `^gs:.*:annotations$` key on the current origin and flattens it into the
 * popup view model, grouped by document (most-recently-modified first). Built
 * on popup open, never on the load hot path.
 *
 * The document URL for navigation is reconstructed directly from the key's stem
 * (`gs:${stem}:annotations`), so no separate stored URL is needed; the
 * envelope's `title` provides a friendly label, falling back to the pathname.
 */

import { urlStem } from '../utils/slider-persistence';
import { parseIdentityKey } from './annotation-identity';

export interface CrossDocEntry {
  readonly key: string;
  readonly documentUrl: string;
  readonly documentLabel: string;
  readonly isCurrentDocument: boolean;
  readonly columnLabel: string;
  readonly previewText: string;
  readonly modifiedAt: number;
}

export type AnnotationPopupViewModel = ReadonlyArray<{
  readonly documentUrl: string;
  readonly documentLabel: string;
  readonly entries: readonly CrossDocEntry[];
}>;

const KEY_RE = /^gs:(.*):annotations$/;

interface MutableGroup {
  documentUrl: string;
  documentLabel: string;
  entries: CrossDocEntry[];
  latest: number;
}

function stemPathname(stem: string): string {
  try {
    return new URL(stem).pathname || stem;
  } catch {
    return stem;
  }
}

function humanise(columnKey: string): string {
  return columnKey.replace(/-/g, ' ');
}

/** Scan localStorage for every annotation key on the current origin and build
 *  the grouped popup view model. */
export function buildCrossDocumentIndex(): AnnotationPopupViewModel {
  if (typeof localStorage === 'undefined') return [];
  const current = urlStem();
  const groups = new Map<string, MutableGroup>();

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const m = KEY_RE.exec(k);
      if (!m) continue;
      const stem = m[1];
      const raw = localStorage.getItem(k);
      if (!raw) continue;

      let env: { version?: number; title?: unknown; entries?: unknown };
      try {
        env = JSON.parse(raw);
      } catch {
        continue;
      }
      if (!env || env.version !== 1 || !env.entries || typeof env.entries !== 'object') {
        continue;
      }

      const documentLabel =
        typeof env.title === 'string' && env.title ? env.title : stemPathname(stem);
      let g = groups.get(stem);
      if (!g) {
        g = { documentUrl: stem, documentLabel, entries: [], latest: 0 };
        groups.set(stem, g);
      }

      for (const [key, value] of Object.entries(env.entries as Record<string, unknown>)) {
        const id = parseIdentityKey(key);
        if (!id) continue;
        if (!value || typeof value !== 'object') continue;
        const entry = value as { t?: unknown; m?: unknown };
        if (typeof entry.t !== 'string' || !entry.t) continue;
        const modifiedAt =
          typeof entry.m === 'number' && isFinite(entry.m) ? entry.m : 0;
        g.entries.push({
          key,
          documentUrl: stem,
          documentLabel,
          isCurrentDocument: stem === current,
          columnLabel: humanise(id.columnKey),
          previewText: entry.t,
          modifiedAt,
        });
        if (modifiedAt > g.latest) g.latest = modifiedAt;
      }
    }
  } catch {
    return [];
  }

  return Array.from(groups.values())
    .filter((g) => g.entries.length > 0)
    .sort((a, b) => b.latest - a.latest)
    .map((g) => ({
      documentUrl: g.documentUrl,
      documentLabel: g.documentLabel,
      entries: g.entries.slice().sort((a, b) => b.modifiedAt - a.modifiedAt),
    }));
}
