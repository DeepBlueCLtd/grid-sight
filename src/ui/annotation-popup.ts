/**
 * Cross-document "Show annotations" popup (spec 006, P3 / R-6).
 *
 * `registerAnnotationsMenuEntry` adds a GS-surface entry that is visible only
 * when the current origin has ≥ 1 annotation (FR-020). `openAnnotationsPopup`
 * renders the cross-document index grouped by document with last-modified
 * dates; arrow keys navigate, Enter activates, Escape closes (FR-022).
 * Activating an entry scrolls + pulses a same-document cell, or navigates to
 * `documentUrl#gs.annot=key` for another same-origin document (FR-021).
 */

import { installPopupChrome } from './popup-chrome';
import { buildCrossDocumentIndex } from '../enrichments/annotation-index';
import type { CrossDocEntry } from '../enrichments/annotation-index';
import {
  hasAnyAnnotationsForOrigin,
  consumeNavigationHint,
} from '../enrichments/annotations';
import { resolveCell, parseIdentityKey } from '../enrichments/annotation-identity';
import { pulseMarker } from './annotation-affordance';
import { ensureAnnotationStyles } from '../enrichments/annotation-styles';

const ENTRY_CLASS = 'gs-annotations-menu-entry';
const ENTRY_BUTTON_CLASS = 'gs-annotation-popup__entry';

let openDispose: (() => void) | null = null;

/** Add the "Show annotations" entry to the GS surface; visible only when the
 *  origin has ≥ 1 annotation. Idempotent. */
export function registerAnnotationsMenuEntry(): void {
  if (typeof document === 'undefined') return;
  ensureAnnotationStyles();

  const existing = document.querySelector<HTMLButtonElement>(`.${ENTRY_CLASS}`);
  if (!hasAnyAnnotationsForOrigin()) {
    existing?.remove();
    return;
  }
  if (existing) return;

  const entry = document.createElement('button');
  entry.type = 'button';
  entry.className = ENTRY_CLASS;
  entry.textContent = 'Show annotations';
  entry.addEventListener('click', () => openAnnotationsPopup());
  document.body.appendChild(entry);
}

function formatDate(ms: number): string {
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleDateString();
  } catch {
    return '';
  }
}

function activateEntry(entry: CrossDocEntry): void {
  if (entry.isCurrentDocument) {
    const id = parseIdentityKey(entry.key);
    const cell = id ? resolveCell(id) : null;
    if (cell) {
      try {
        cell.scrollIntoView({ block: 'center' });
      } catch {
        /* ignore */
      }
      pulseMarker(cell);
    }
    return;
  }
  if (typeof location !== 'undefined') {
    location.href = `${entry.documentUrl}#gs.annot=${encodeURIComponent(entry.key)}`;
  }
}

/** Open the cross-document popup. */
export function openAnnotationsPopup(): void {
  if (typeof document === 'undefined') return;
  ensureAnnotationStyles();

  if (openDispose) {
    openDispose();
    openDispose = null;
  }

  const model = buildCrossDocumentIndex();

  const popup = document.createElement('div');
  popup.className = 'gs-annotation-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', 'Annotations');

  const entryButtons: HTMLButtonElement[] = [];

  if (model.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'gs-annotation-popup__empty';
    empty.textContent = 'No annotations yet.';
    popup.appendChild(empty);
  } else {
    for (const group of model) {
      const groupEl = document.createElement('div');
      groupEl.className = 'gs-annotation-popup__group';

      const label = document.createElement('div');
      label.className = 'gs-annotation-popup__group-label';
      label.textContent = group.documentLabel;
      groupEl.appendChild(label);

      for (const entry of group.entries) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = ENTRY_BUTTON_CLASS;

        const text = document.createElement('span');
        text.className = 'gs-annotation-popup__entry-text';
        text.textContent = entry.previewText;

        const meta = document.createElement('span');
        meta.className = 'gs-annotation-popup__entry-meta';
        const date = formatDate(entry.modifiedAt);
        meta.textContent = date ? `${entry.columnLabel} · ${date}` : entry.columnLabel;

        btn.appendChild(text);
        btn.appendChild(meta);
        btn.addEventListener('click', () => {
          dispose();
          activateEntry(entry);
        });
        entryButtons.push(btn);
        groupEl.appendChild(btn);
      }
      popup.appendChild(groupEl);
    }
  }

  // Arrow-key navigation between entries (FR-022).
  popup.addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
    if (entryButtons.length === 0) return;
    ev.preventDefault();
    const idx = entryButtons.indexOf(document.activeElement as HTMLButtonElement);
    const delta = ev.key === 'ArrowDown' ? 1 : -1;
    const next = (idx + delta + entryButtons.length) % entryButtons.length;
    entryButtons[next].focus();
  });

  document.body.appendChild(popup);
  popup.style.position = 'fixed';
  popup.style.top = '12px';
  popup.style.right = '12px';

  const focusables: HTMLElement[] = entryButtons.length > 0 ? entryButtons : [popup];
  if (entryButtons.length === 0) popup.tabIndex = -1;

  const dispose = installPopupChrome(popup, document.body, focusables, () => {
    openDispose = null;
  });
  openDispose = dispose;

  focusables[0].focus();
}

// Re-export so index.ts can wire the load-time hint consumer alongside the
// popup registration in one import.
export { consumeNavigationHint };
