/**
 * Twin-table slider controller (spec 016 §3.2).
 *
 * Renders the two (or more) season blocks as *synced sub-tables*:
 *  - one shared horizontal Direction (column) slider injected at the top;
 *  - one vertical Speed (row) slider per block, injected into that block's
 *    merged group cell, all sharing a single Speed value.
 *
 * Dragging any enabled Speed slider updates the shared value, so every block's
 * slider tracks it. When the shared Speed leaves a block's range that block's
 * slider is DISABLED and its interpolated readout + highlight rectangle are
 * cleared (not clamped) — the one twin-specific rule over the reused
 * `bilinear` + highlight machinery.
 *
 * This controller is self-contained: the single-grid slider path (`slider.ts`)
 * is untouched, so ordinary tables cannot regress.
 */

import { detectTwin, type TwinModel, type TwinBlock } from '../core/twin-grid';
import { evalBlock, headerRange, type BlockEval } from './twin-interp';
import { SLIDER_HIGHLIGHT_CLASSES } from './slider-readout';
import { formatNumber } from '../ui/slider-control';

const STYLE_ID = 'gs-twin-slider-styles';
const INJECTED = 'data-gs-injected';

interface BlockUi {
  block: TwinBlock;
  input: HTMLInputElement;
  readout: HTMLElement;
  /** Circle overlay showing the interpolated point inside the bracket. */
  marker: HTMLElement;
  min: number;
  max: number;
}

interface TwinController {
  destroy(): void;
}

const active = new WeakMap<HTMLTableElement, TwinController>();

/* ── Styles ─────────────────────────────────────────────────────────────── */

function ensureStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .gs-twin-block-ui { display:flex; flex-direction:column; align-items:center; gap:4px; padding:4px 0; }
    .gs-twin-block-ui input[type=range][orient=vertical] {
      /* No 'direction: rtl' — that would put the min at the bottom, inverting the
       * slider relative to the table rows (row-header min is the TOP row). With
       * plain vertical-lr the thumb top = min speed = top row (spec 016). */
      writing-mode: vertical-lr; width:16px; height:84px; accent-color:#1976d2;
    }
    .gs-twin-block-ui input[type=range]:disabled { opacity:0.4; cursor:not-allowed; }
    .gs-twin-readout { font:600 11px/1.3 system-ui,sans-serif; color:#1976d2; text-align:center; font-variant-numeric:tabular-nums; }
    .gs-twin-readout[data-out-of-range] { color:#999; }
    .gs-twin-dir { display:flex; align-items:center; gap:8px; padding:4px 8px; }
    .gs-twin-dir input[type=range] { flex:1; accent-color:#1976d2; }
    .gs-twin-dir-label { font:600 11px/1 system-ui,sans-serif; color:#444; white-space:nowrap; }
  `;
  document.head.appendChild(style);
}

/* ── Highlight (per block, via direct cell references) ──────────────────── */

function clearBlockHighlight(block: TwinBlock): void {
  for (const row of block.dataCells) {
    for (const cell of row) cell.classList.remove(...SLIDER_HIGHLIGHT_CLASSES);
  }
}

function highlightBlock(block: TwinBlock, e: BlockEval): void {
  clearBlockHighlight(block);
  if (!e.inRange || !e.rowBracket || !e.colBracket) return;
  const [i0, i1] = e.rowBracket;
  const [j0, j1] = e.colBracket;
  const rows = [i0, i1];
  const cols = [j0, j1];
  for (let a = 0; a < rows.length; a++) {
    for (let b = 0; b < cols.length; b++) {
      const cell = block.dataCells[rows[a]]?.[cols[b]];
      if (!cell) continue;
      cell.classList.add('gs-slider-highlight');
      if (a === 0) cell.classList.add('gs-slider-highlight-t');
      if (a === rows.length - 1) cell.classList.add('gs-slider-highlight-b');
      if (b === 0) cell.classList.add('gs-slider-highlight-l');
      if (b === cols.length - 1) cell.classList.add('gs-slider-highlight-r');
    }
  }
}

/* ── Interpolated-position marker (the circle) ──────────────────────────── */

/** Make the table's positioning ancestor `relative` so absolutely-positioned
 *  markers are placed against it (mirrors heatmap-marker.ts). */
function ensureParentPositioned(table: HTMLTableElement): HTMLElement | null {
  const parent = table.parentElement;
  if (!parent) return null;
  if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
  return parent;
}

function makeMarker(): HTMLElement {
  const m = document.createElement('div');
  m.setAttribute('data-gs-marker', '');
  m.setAttribute('aria-hidden', 'true');
  m.style.display = 'none';
  return m;
}

function frac(a: number, b: number, x: number): number {
  if (b === a) return 0;
  return Math.min(1, Math.max(0, (x - a) / (b - a)));
}

/** Place `marker` at the interpolated (speed, dir) point inside the block's
 *  four-cell bracket, or hide it when the block is out of range. */
function positionMarker(
  marker: HTMLElement,
  block: TwinBlock,
  colHeaders: number[],
  speed: number,
  dir: number,
  e: BlockEval,
  table: HTMLTableElement,
): void {
  if (!e.inRange || !e.rowBracket || !e.colBracket) {
    marker.style.display = 'none';
    return;
  }
  const [i0, i1] = e.rowBracket;
  const [j0, j1] = e.colBracket;
  const c00 = block.dataCells[i0]?.[j0];
  const c11 = block.dataCells[i1]?.[j1];
  const parent = table.parentElement;
  if (!c00 || !c11 || !parent) {
    marker.style.display = 'none';
    return;
  }
  const pr = parent.getBoundingClientRect();
  const r00 = c00.getBoundingClientRect();
  const r11 = c11.getBoundingClientRect();
  const tr = frac(block.rowHeaders[i0], block.rowHeaders[i1], speed);
  const tc = frac(colHeaders[j0], colHeaders[j1], dir);
  const xL = r00.left + r00.width / 2;
  const xR = r11.left + r11.width / 2;
  const yT = r00.top + r00.height / 2;
  const yB = r11.top + r11.height / 2;
  marker.style.left = `${xL + tc * (xR - xL) - pr.left}px`;
  marker.style.top = `${yT + tr * (yB - yT) - pr.top}px`;
  marker.style.display = '';
}

/* ── Injection ──────────────────────────────────────────────────────────── */

function makeRange(min: number, max: number, value: number, aria: string, vertical: boolean): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = 'any';
  input.value = String(Math.min(max, Math.max(min, value)));
  input.setAttribute('aria-label', aria);
  input.setAttribute('data-gs-twin-input', vertical ? 'speed' : 'dir');
  if (vertical) input.setAttribute('orient', 'vertical');
  return input;
}

function injectDirectionRow(
  table: HTMLTableElement,
  model: TwinModel,
  dir: number,
  onInput: (v: number) => void,
): { row: HTMLTableRowElement; readout: HTMLElement } {
  const [min, max] = headerRange(model.colHeaders);
  const tr = document.createElement('tr');
  tr.setAttribute(INJECTED, '');
  tr.setAttribute('data-gs-twin-row', '');

  const corner = document.createElement('th');
  corner.setAttribute(INJECTED, '');
  corner.colSpan = model.labelColumnCount;
  const readout = document.createElement('div');
  readout.className = 'gs-twin-dir-label';
  corner.appendChild(readout);

  const slot = document.createElement('th');
  slot.setAttribute(INJECTED, '');
  slot.colSpan = model.colHeaders.length;
  const wrap = document.createElement('div');
  wrap.className = 'gs-twin-dir';
  const label = document.createElement('span');
  label.className = 'gs-twin-dir-label';
  label.textContent = 'Direction';
  const input = makeRange(min, max, dir, 'Direction slider', false);
  input.addEventListener('input', () => onInput(parseFloat(input.value)));
  wrap.append(label, input);
  slot.appendChild(wrap);

  tr.append(corner, slot);

  const body = table.tBodies[0] ?? table;
  const firstRow = body.rows[0] ?? null;
  if (firstRow) body.insertBefore(tr, firstRow);
  else body.appendChild(tr);
  return { row: tr, readout };
}

function injectBlockSlider(
  block: TwinBlock,
  speed: number,
  onInput: (v: number) => void,
): BlockUi {
  const [min, max] = headerRange(block.rowHeaders);
  const wrap = document.createElement('div');
  wrap.className = 'gs-twin-block-ui';
  wrap.setAttribute('data-gs-twin-block-ui', '');

  const input = makeRange(min, max, speed, `${block.label} speed slider`, true);
  input.addEventListener('input', () => onInput(parseFloat(input.value)));

  const readout = document.createElement('div');
  readout.className = 'gs-twin-readout';
  readout.setAttribute('aria-live', 'polite');
  readout.textContent = '—';

  wrap.append(input, readout);
  block.groupCell.appendChild(wrap);
  return { block, input, readout, marker: makeMarker(), min, max };
}

/* ── Controller ─────────────────────────────────────────────────────────── */

function overlapMidpoint(model: TwinModel): number {
  let lo = -Infinity;
  let hi = Infinity;
  for (const b of model.blocks) {
    const [bl, bh] = headerRange(b.rowHeaders);
    lo = Math.max(lo, bl);
    hi = Math.min(hi, bh);
  }
  if (lo <= hi) return (lo + hi) / 2; // overlap exists
  // No common overlap — fall back to the union midpoint.
  let umin = Infinity;
  let umax = -Infinity;
  for (const b of model.blocks) {
    const [bl, bh] = headerRange(b.rowHeaders);
    umin = Math.min(umin, bl);
    umax = Math.max(umax, bh);
  }
  return (umin + umax) / 2;
}

/** Enable the twin controller on `table`. No-op (returns existing) if already on. */
export function enableTwinSliders(table: HTMLTableElement): boolean {
  if (active.has(table)) return true;
  const model = detectTwin(table);
  if (!model) return false;
  ensureStyles();

  const [dirMin, dirMax] = headerRange(model.colHeaders);
  const state = { speed: overlapMidpoint(model), dir: (dirMin + dirMax) / 2 };
  const uis: BlockUi[] = [];

  const render = (): void => {
    for (const ui of uis) {
      const e = evalBlock(ui.block.rowHeaders, model.colHeaders, ui.block.matrix, state.speed, state.dir);
      highlightBlock(ui.block, e);
      positionMarker(ui.marker, ui.block, model.colHeaders, state.speed, state.dir, e, table);
      const outOfRange = !e.inRange;
      ui.input.disabled = outOfRange;
      if (!outOfRange) ui.input.value = String(Math.min(ui.max, Math.max(ui.min, state.speed)));
      if (outOfRange) {
        ui.readout.textContent = '—';
        ui.readout.setAttribute('data-out-of-range', '');
        ui.input.title = `${ui.block.label}: ${formatNumber(state.speed)} is outside ${formatNumber(ui.min)}–${formatNumber(ui.max)}`;
      } else {
        ui.readout.textContent = isFinite(e.value)
          ? `${ui.block.label}: ${formatNumber(e.value)}`
          : '—';
        ui.readout.removeAttribute('data-out-of-range');
        ui.input.title = `${ui.block.label} speed`;
      }
    }
    dirReadout.textContent = `Speed ${formatNumber(state.speed)} · Direction ${formatNumber(state.dir)}`;
  };

  const onSpeed = (v: number): void => {
    if (!isFinite(v)) return;
    state.speed = v;
    render();
  };
  const onDir = (v: number): void => {
    if (!isFinite(v)) return;
    state.dir = v;
    render();
  };

  const { row: dirRow, readout: dirReadout } = injectDirectionRow(table, model, state.dir, onDir);
  const markerHost = ensureParentPositioned(table);
  for (const block of model.blocks) {
    const ui = injectBlockSlider(block, state.speed, onSpeed);
    markerHost?.appendChild(ui.marker);
    uis.push(ui);
  }
  render();

  // Cell geometry shifts on resize — reposition the markers (highlights are
  // class-based and need no repositioning).
  const onResize = (): void => {
    for (const ui of uis) {
      const e = evalBlock(ui.block.rowHeaders, model.colHeaders, ui.block.matrix, state.speed, state.dir);
      positionMarker(ui.marker, ui.block, model.colHeaders, state.speed, state.dir, e, table);
    }
  };
  if (typeof window !== 'undefined') window.addEventListener('resize', onResize);

  const controller: TwinController = {
    destroy() {
      if (typeof window !== 'undefined') window.removeEventListener('resize', onResize);
      dirRow.parentElement?.removeChild(dirRow);
      for (const ui of uis) {
        clearBlockHighlight(ui.block);
        ui.marker.remove();
        ui.block.groupCell.querySelector('[data-gs-twin-block-ui]')?.remove();
      }
      active.delete(table);
    },
  };
  active.set(table, controller);
  return true;
}

export function disableTwinSliders(table: HTMLTableElement): void {
  active.get(table)?.destroy();
}

export function isTwinSlidersActive(table: HTMLTableElement): boolean {
  return active.has(table);
}
