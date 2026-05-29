/**
 * Outlier lozenge (`!`) — spec 004-outlier, FR-001/FR-003/FR-004/FR-009/FR-011.
 *
 * Mirrors `createSortLozenge`: a `<button data-gs-lozenge-id="outlier">` with an
 * internal `refresh()` that re-reads the live directive each render. Clicking
 * cycles `idle → 2σ → 1σ → 3σ → idle`; the glyph shows `!`/`!2`/`!1`/`!3`;
 * `aria-pressed` + the accessible name track the current threshold and the next
 * action. A σ = 0 column renders an INERT lozenge (click is a no-op).
 *
 * While a threshold is active, a secondary "show list" button appears (mouse)
 * and `Shift`+`Enter` on the lozenge opens the same list (keyboard) — FR-011.
 *
 * Returns the cluster fragment (the `!` button + the list button) so the header
 * injection pass mounts a single element.
 */

import { nextThreshold, type OutlierThreshold } from '../enrichments/outlier-marks';

export interface OutlierLozengeArgs {
  columnIndex: number;
  columnKey: string;
  /** false when σ = 0 — the lozenge renders but click is a no-op (FR-009). */
  inert: boolean;
  /** Human column label for the accessible name. */
  columnLabel: string;
  /** Reads the live directive each refresh. */
  getCurrent: () => OutlierThreshold | null;
  onChange: (next: OutlierThreshold | null) => void;
  /** Secondary affordance: open the outliers list (FR-011). */
  onShowList: () => void;
}

const LOZENGE_CLASS = 'gs-lozenge';
const LOZENGE_OUTLIER_CLASS = 'gs-lozenge--outlier';
const LOZENGE_ACTIVE_CLASS = 'gs-lozenge--active';
const LIST_CLASS = 'gs-lozenge gs-lozenge--outlier-list';
const INERT_TITLE = 'All values equal; no outliers to flag';

function glyph(current: OutlierThreshold | null): string {
  return current === null ? '!' : `!${current}`;
}

function actionLabel(current: OutlierThreshold | null, args: OutlierLozengeArgs): string {
  if (args.inert) return INERT_TITLE;
  const col = args.columnLabel;
  if (current === null) return `Mark outliers in column '${col}' at 2σ`;
  const next = nextThreshold(current);
  const nextDesc = next === null ? 'click to clear' : `click for ${next}σ`;
  return `Outliers in column '${col}' at ${current}σ; ${nextDesc}`;
}

export function createOutlierLozenge(args: OutlierLozengeArgs): HTMLElement {
  const cluster = document.createElement('span');
  cluster.className = 'gs-outlier-cluster';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `${LOZENGE_CLASS} ${LOZENGE_OUTLIER_CLASS}`;
  btn.setAttribute('data-gs-lozenge-id', 'outlier');

  const listBtn = document.createElement('button');
  listBtn.type = 'button';
  listBtn.className = LIST_CLASS;
  listBtn.setAttribute('data-gs-outlier-list', '');
  listBtn.textContent = '≡';
  listBtn.setAttribute(
    'aria-label',
    `Show outliers list for column '${args.columnLabel}'`,
  );
  listBtn.title = `Show outliers list for column '${args.columnLabel}'`;
  listBtn.style.display = 'none';

  const refresh = (): void => {
    const current = args.getCurrent();
    const active = current !== null;
    btn.textContent = glyph(current);
    btn.classList.toggle(LOZENGE_ACTIVE_CLASS, active);
    // Inert columns never report "pressed" (FR-009); active columns do (FR-004).
    btn.setAttribute('aria-pressed', String(active && !args.inert));
    const label = actionLabel(current, args);
    btn.setAttribute('aria-label', label);
    btn.title = label;
    if (args.inert) btn.title = INERT_TITLE;
    // The list affordance exists only while flagging is active (FR-011).
    listBtn.style.display = active && !args.inert ? '' : 'none';
  };
  refresh();

  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (args.inert) return; // no-op (FR-009)
    args.onChange(nextThreshold(args.getCurrent()));
    refresh();
  });

  // Shift+Enter opens the list while focused on the lozenge (keyboard, FR-011).
  btn.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.shiftKey) {
      ev.preventDefault();
      ev.stopPropagation();
      if (!args.inert && args.getCurrent() !== null) args.onShowList();
    }
  });

  listBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    args.onShowList();
  });

  // Expose refresh so the header injection can re-probe after external changes.
  (btn as unknown as { __gsRefreshOutlier?: () => void }).__gsRefreshOutlier = refresh;

  cluster.appendChild(btn);
  cluster.appendChild(listBtn);
  return cluster;
}
