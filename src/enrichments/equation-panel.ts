/**
 * Info panel for the slider corner's "calculated result" readout. Opened from
 * the ⓘ button next to the equation value; shows the registered equation, the
 * current row/column inputs, and the resulting value. Dismiss + focus handling
 * is shared with the filter popups via popup-chrome.
 */

import { formatNumber } from '../ui/slider-control';
import { installPopupChrome, positionPopup } from '../ui/popup-chrome';

export interface EquationSnapshot {
  expression: string | null;
  rowValue: number | null;
  colValue: number | null;
  result: number;
}

const STYLE_ID = 'gs-equation-panel-styles';

const PANEL_CSS = `
.gs-eqp {
  position: absolute; z-index: 10000; min-width: 200px; max-width: 280px;
  background: #fff; border: 1px solid #e0e0e0; border-radius: 6px;
  box-shadow: 0 4px 20px rgb(0 0 0 / 15%); padding: 10px 12px; outline: none;
  font: 13px/1.4 system-ui, sans-serif; color: #333;
}
.gs-eqp b { display: block; font-size: 12px; color: #6a1b9a; margin-bottom: 6px; }
.gs-eqp code {
  display: block; font-size: 13px; background: #f6f2fa; border-radius: 4px;
  padding: 6px 8px; margin-bottom: 8px; word-break: break-word;
}
.gs-eqp dl { margin: 0; }
.gs-eqp div {
  display: flex; justify-content: space-between; gap: 12px;
  padding: 4px 0; border-bottom: 1px solid #f4f4f4;
}
.gs-eqp div:last-child { border-bottom: none; font-weight: 600; }
.gs-eqp span { color: #666; }
.gs-eqp var { font-style: normal; font-variant-numeric: tabular-nums; }
`;

function injectStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);
}

function buildRow(label: string, value: string): HTMLDivElement {
  const row = document.createElement('div');
  const l = document.createElement('span');
  l.textContent = label;
  const v = document.createElement('var');
  v.textContent = value;
  row.append(l, v);
  return row;
}

let dispose: (() => void) | null = null;

/** Open the panel anchored to `anchor`. Clicking the same anchor while open
 *  toggles it closed. */
export function openEquationPanel(anchor: HTMLElement, snap: EquationSnapshot): void {
  if (dispose) { dispose(); dispose = null; return; }
  injectStyles();

  const panel = document.createElement('div');
  panel.className = 'gs-eqp';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Calculation details');
  panel.tabIndex = -1;

  const title = document.createElement('b');
  title.textContent = 'Calculated result';
  panel.appendChild(title);

  if (snap.expression) {
    const eq = document.createElement('code');
    eq.textContent = snap.expression;
    panel.appendChild(eq);
  }

  if (snap.rowValue !== null) panel.appendChild(buildRow('Row input', formatNumber(snap.rowValue)));
  if (snap.colValue !== null) panel.appendChild(buildRow('Column input', formatNumber(snap.colValue)));
  panel.appendChild(buildRow('Result', isFinite(snap.result) ? formatNumber(snap.result) : '—'));

  document.body.appendChild(panel);
  positionPopup(panel, anchor);

  dispose = installPopupChrome(panel, anchor, [], () => { dispose = null; });
  panel.focus();
}
