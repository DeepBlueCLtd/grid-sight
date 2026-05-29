/**
 * Outliers list popup (spec 004-outlier, FR-012/FR-013/FR-014/FR-020).
 *
 * A focus-trapped `role="dialog"` listing every marked cell as
 * `row label — value — σ distance`, sorted by descending `|σ|` (doc-order
 * tie-break). Activating an entry scrolls its row into view and briefly
 * highlights it WITHOUT closing the popup. Built on the shared
 * `installPopupChrome` (Escape / Tab-trap / outside-click / return-focus) and
 * `positionPopup` — the same primitives the filter popups use.
 */

import { installPopupChrome, positionPopup } from './popup-chrome';
import {
  sortMarksByDistance,
  formatOutlierValue,
  type OutlierMark,
} from '../enrichments/outlier-marks';
import { ensureOutlierStyles } from '../enrichments/outlier-styles';

export interface OutlierPopupArgs {
  table: HTMLTableElement;
  columnIndex: number;
  columnLabel: string;
  threshold: 1 | 2 | 3;
  /** The lozenge — for positioning and focus-return on close. */
  anchor: HTMLElement;
  getMarks: () => readonly OutlierMark[];
  /** Fired after the popup closes (Escape / outside-click / dispose), so the
   *  caller can null out its handle and treat the next activation as "reopen". */
  onClose?: () => void;
}

const HIGHLIGHT_CLASS = 'gs-outlier-row-highlight';
const HIGHLIGHT_MS = 1200;

/** Disposers for every currently-open popup, so teardown can close them all. */
const openPopups = new Set<() => void>();

/** Open the focus-trapped outliers dialog; returns `dispose()` (FR-014). */
export function openOutlierPopup(args: OutlierPopupArgs): () => void {
  ensureOutlierStyles();
  const marks = sortMarksByDistance(args.getMarks());

  const popup = document.createElement('div');
  popup.className = 'gs-outlier-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('data-gs-injected', '');
  popup.setAttribute(
    'aria-label',
    `Outliers in column '${args.columnLabel}' at ${args.threshold}σ`,
  );

  const title = document.createElement('div');
  title.className = 'gs-outlier-popup__title';
  title.textContent = `Outliers — ${args.columnLabel} (${args.threshold}σ)`;
  popup.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'gs-outlier-popup__list';
  const focusables: HTMLElement[] = [];

  for (const mark of marks) {
    const li = document.createElement('li');
    const entry = document.createElement('button');
    entry.type = 'button';
    entry.className = 'gs-outlier-popup__entry';

    const label = document.createElement('span');
    label.className = 'gs-outlier-popup__label';
    label.textContent = `${mark.rowLabel || '—'} — ${formatOutlierValue(mark.value)}`;

    const sigma = document.createElement('span');
    sigma.className = 'gs-outlier-popup__sigma';
    sigma.textContent = signedSigma(mark.sigmaDistance);

    entry.appendChild(label);
    entry.appendChild(sigma);
    entry.addEventListener('click', (ev) => {
      ev.stopPropagation();
      revealRow(mark.cell); // scroll + highlight; popup stays open (FR-013)
    });

    li.appendChild(entry);
    list.appendChild(li);
    focusables.push(entry);
  }

  popup.appendChild(list);
  document.body.appendChild(popup);
  positionPopup(popup, args.anchor);

  const dispose = installPopupChrome(popup, args.anchor, focusables, () => {
    openPopups.delete(dispose);
    args.onClose?.();
  });
  openPopups.add(dispose);

  if (focusables.length > 0) {
    try {
      focusables[0].focus();
    } catch {
      /* ignore */
    }
  }
  return dispose;
}

/** Close every open outliers popup (used by `tearDownOutliers`, FR-021). */
export function closeAllOutlierPopups(): void {
  for (const dispose of Array.from(openPopups)) dispose();
  openPopups.clear();
}

function revealRow(cell: HTMLTableCellElement): void {
  const row = cell.closest('tr');
  if (!row) return;
  if (typeof row.scrollIntoView === 'function') {
    try {
      row.scrollIntoView({ block: 'nearest' });
    } catch {
      /* jsdom / older engines */
    }
  }
  row.classList.add(HIGHLIGHT_CLASS);
  if (typeof window !== 'undefined') {
    window.setTimeout(() => row.classList.remove(HIGHLIGHT_CLASS), HIGHLIGHT_MS);
  }
}

function signedSigma(sigma: number): string {
  return `${sigma >= 0 ? '+' : '-'}${Math.abs(sigma).toFixed(1)}σ`;
}
