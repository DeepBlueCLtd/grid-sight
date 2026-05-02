/**
 * Axis-slider orchestrator.
 *
 * Sliders are injected DIRECTLY INTO the host table — column slider in a
 * prepended row's `<th colspan=N>` slot, row slider in a `<th rowspan=N>` cell
 * inserted at the start of the original header row. Style injection,
 * structural injection, and readout/highlight pipelines live in adjacent
 * modules so this orchestrator stays small.
 *
 * See specs/001-dynamic-sliders/data-model.md for entity definitions.
 */

import { deriveSyncKey } from '../utils/sync-key';
import {
  resolveInitialPosition,
  persistPosition,
  pruneEntry,
} from '../utils/slider-persistence';
import { formatNumber } from '../ui/slider-control';
import { injectSliderStyles } from './slider-styles';
import {
  buildAxisBinding,
  ensureInjection,
  ensureRowSliderSlot,
  ensureTopRow,
  tableContexts,
  tearDownInjection,
} from './slider-injection';
import type { Axis, AxisBinding, TableContext } from './slider-injection';
import { refreshTable } from './slider-readout';

export type { Axis, AxisBinding };
export { buildAxisBinding };

/** Minimal handle exposed for legacy compatibility — the slider input + readout
 *  spans live inside the host table. */
export interface SliderHandle {
  root: HTMLElement;
  input: HTMLInputElement;
  readoutInterpolated: HTMLElement;
  readoutEquation: HTMLElement | null;
  setEquationReadout(_text: string | null): void;
  setInterpolatedReadout(_text: string): void;
  setValue(value: number, opts?: { silent?: boolean }): void;
  getValue(): number;
  destroy(): void;
}

export interface GridSightSlider {
  readonly id: string;
  readonly kind: 'axis' | 'threshold';
  readonly axis: Axis | undefined;
  position: number;
  position01: number;
  readonly tableId: string;
  readonly syncKey: string | null;
  handle: SliderHandle;
  setPosition(value: number, opts?: { silent?: boolean; broadcast?: boolean }): void;
  destroy(): void;
}

interface InternalSlider extends GridSightSlider {
  binding: AxisBinding | null;
  table: HTMLTableElement;
}

const sliderRegistry: InternalSlider[] = [];
const formulaRegistry = new WeakMap<HTMLTableElement, (rowVal: number, colVal: number) => number>();
const recomputeListeners = new Set<() => void>();

// Inject CSS once at module load.
injectSliderStyles();

let idCounter = 0;
function ensureTableId(table: HTMLTableElement): string {
  if (!table.id) {
    idCounter += 1;
    table.id = `gs-tbl-${idCounter}`;
  }
  return table.id;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Recompute / sync helpers                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function getAxisSlidersForTable(table: HTMLTableElement): InternalSlider[] {
  return sliderRegistry.filter(s => s.kind === 'axis' && s.table === table);
}

function asAxisRef(s: InternalSlider | undefined): { axis: 'row' | 'col'; position: number } | null {
  if (!s || (s.axis !== 'row' && s.axis !== 'col')) return null;
  return { axis: s.axis, position: s.position };
}

function collectAxisRefs(table: HTMLTableElement): {
  row: { axis: 'row' | 'col'; position: number } | null;
  col: { axis: 'row' | 'col'; position: number } | null;
} {
  const axes = getAxisSlidersForTable(table);
  return {
    row: asAxisRef(axes.find(s => s.axis === 'row')),
    col: asAxisRef(axes.find(s => s.axis === 'col')),
  };
}

function notifyRecomputeListeners(): void {
  for (const cb of recomputeListeners) {
    try { cb(); } catch (err) { console.warn(err); }
  }
}

function refreshTableReadouts(table: HTMLTableElement): void {
  const ctx = tableContexts.get(table);
  if (!ctx) return;
  const { row, col } = collectAxisRefs(table);
  refreshTable(ctx, row, col, formulaRegistry.get(table));
  notifyRecomputeListeners();
}

function broadcastSync(driver: InternalSlider): void {
  if (!driver.syncKey) return;
  if (driver.table.hasAttribute('data-gs-no-sync')) return;
  for (const s of sliderRegistry) {
    if (s === driver || s.kind !== 'axis') continue;
    if (s.syncKey !== driver.syncKey) continue;
    if (s.table.hasAttribute('data-gs-no-sync')) continue;
    if (s.position !== driver.position) {
      s.setPosition(driver.position, { silent: false, broadcast: false });
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Slider input + DOM placement                                               */
/* ────────────────────────────────────────────────────────────────────────── */

function createSliderInput(opts: {
  id: string;
  min: number;
  max: number;
  initial: number;
  axis: Axis;
  ariaLabel: string;
}): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(opts.min);
  input.max = String(opts.max);
  input.step = 'any';
  input.value = String(Math.min(opts.max, Math.max(opts.min, opts.initial)));
  input.id = `gs-slider-${opts.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  input.setAttribute('aria-label', opts.ariaLabel);
  input.setAttribute('data-gs-slider-input', opts.axis);
  // Firefox honours `orient` for vertical sliders; styling comes from CSS.
  if (opts.axis === 'row') input.setAttribute('orient', 'vertical');
  return input;
}

function buildValueLabel(initial: number): { label: HTMLDivElement; valueSpan: HTMLSpanElement } {
  const valueSpan = document.createElement('span');
  valueSpan.style.fontVariantNumeric = 'tabular-nums';
  valueSpan.style.fontSize = '12px';
  valueSpan.textContent = formatNumber(initial);
  const label = document.createElement('div');
  label.style.fontSize = '11px';
  label.style.color = '#444';
  label.appendChild(valueSpan);
  return { label, valueSpan };
}

function placeColSlider(ctx: TableContext, input: HTMLInputElement, initial: number): HTMLSpanElement {
  ensureTopRow(ctx);
  const slot = ctx.colSliderCell!;
  slot.innerHTML = '';
  slot.appendChild(input);
  const { label, valueSpan } = buildValueLabel(initial);
  label.insertBefore(document.createTextNode('SL: '), valueSpan);
  slot.appendChild(label);
  ctx.colValueSpan = valueSpan;
  return valueSpan;
}

function placeRowSlider(ctx: TableContext, input: HTMLInputElement, initial: number): HTMLSpanElement {
  ensureTopRow(ctx);
  const slot = ensureRowSliderSlot(ctx);
  slot.innerHTML = '';
  slot.appendChild(input);
  const headerCell = ctx.rowSliderHeaderCell!;
  headerCell.innerHTML = '';
  const { label, valueSpan } = buildValueLabel(initial);
  label.insertBefore(document.createTextNode('Range: '), valueSpan);
  headerCell.appendChild(label);
  ctx.rowValueSpan = valueSpan;
  return valueSpan;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Keyboard handling                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

function keyboardDelta(key: string, range: number, min: number, max: number, cur: number): number | null {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':   return cur + range * 0.01;
    case 'ArrowLeft':
    case 'ArrowDown': return cur - range * 0.01;
    case 'PageUp':    return cur + range * 0.1;
    case 'PageDown':  return cur - range * 0.1;
    case 'Home':      return min;
    case 'End':       return max;
    default:          return null;
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Slider lifecycle helpers                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function buildSliderHandle(input: HTMLInputElement, ctx: TableContext, schedule: (v: number) => void, min: number, max: number): SliderHandle {
  return {
    root: input.parentElement!,
    input,
    get readoutInterpolated() {
      return (ctx.cornerCell?.querySelector('[data-gs-slider-readout="interpolated"]') as HTMLElement) ?? ctx.cornerCell!;
    },
    get readoutEquation() {
      return ctx.equationLine;
    },
    setEquationReadout: (_text) => { /* equation readout owned by refreshTable */ },
    setInterpolatedReadout: (text) => {
      const el = ctx.cornerCell?.querySelector('[data-gs-slider-readout="interpolated"]');
      if (el) el.textContent = text;
    },
    setValue: (value, options) => {
      const v = Math.min(max, Math.max(min, value));
      input.value = String(v);
      if (!options?.silent) schedule(v);
    },
    getValue: () => parseFloat(input.value),
    destroy: () => { /* handled by slider.destroy() */ },
  };
}

function destroyAxisSlider(slider: InternalSlider, ctx: TableContext): void {
  const idx = sliderRegistry.indexOf(slider);
  if (idx >= 0) sliderRegistry.splice(idx, 1);
  if (slider.axis === 'row') {
    ctx.rowSliderCell?.parentElement?.removeChild(ctx.rowSliderCell);
    ctx.rowSliderHeaderCell?.parentElement?.removeChild(ctx.rowSliderHeaderCell);
    ctx.rowSliderCell = null;
    ctx.rowSliderHeaderCell = null;
    ctx.rowValueSpan = null;
    if (ctx.cornerCell) ctx.cornerCell.colSpan = 1;
  } else {
    if (ctx.colSliderCell) ctx.colSliderCell.innerHTML = '';
    ctx.colValueSpan = null;
  }
  pruneEntry(slider.id);
  const stillHasAxisSlider = sliderRegistry.some(s => s.kind === 'axis' && s.table === ctx.table);
  tearDownInjection(ctx, stillHasAxisSlider);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Public API                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export function addSlider(table: HTMLTableElement, axis: Axis): GridSightSlider {
  if (!table) throw new Error('No table');
  ensureTableId(table);

  const existing = sliderRegistry.find(s => s.kind === 'axis' && s.table === table && s.axis === axis);
  if (existing) throw new Error('Slider already exists');

  const binding = buildAxisBinding(table, axis);
  if (!binding) throw new Error('Axis not numeric');

  const ctx = ensureInjection(table);
  const min = Math.min(...binding.headerValues);
  const max = Math.max(...binding.headerValues);
  const id = `${table.id}#${axis}`;
  const initialPos01 = resolveInitialPosition(id);
  const initial = min + initialPos01 * (max - min);
  const syncKey = deriveSyncKey([...binding.headerValues].map(String));

  const ariaLabel = `${axis === 'row' ? 'Row' : 'Column'} slider (${formatNumber(min)}–${formatNumber(max)})`;
  const input = createSliderInput({ id, min, max, initial, axis, ariaLabel });
  const valueSpan = axis === 'col' ? placeColSlider(ctx, input, initial) : placeRowSlider(ctx, input, initial);

  // RAF-throttled input handler.
  let pendingValue: number | null = null;
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    if (pendingValue !== null) {
      const v = pendingValue;
      pendingValue = null;
      slider.position = v;
      slider.position01 = (v - min) / (max - min);
      valueSpan.textContent = formatNumber(v);
      refreshTableReadouts(table);
      persistPosition(id, slider.position01);
      broadcastSync(slider);
    }
  };
  const schedule = (v: number) => {
    pendingValue = v;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(flush);
  };

  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    if (isFinite(v)) schedule(v);
  });
  input.addEventListener('keydown', (ev: KeyboardEvent) => {
    const range = max - min;
    if (range <= 0) return;
    const cur = parseFloat(input.value);
    const next = keyboardDelta(ev.key, range, min, max, cur);
    if (next === null) return;
    ev.preventDefault();
    const clamped = Math.min(max, Math.max(min, next));
    input.value = String(clamped);
    schedule(clamped);
  });

  const handle = buildSliderHandle(input, ctx, schedule, min, max);
  const slider: InternalSlider = {
    id,
    kind: 'axis',
    axis,
    tableId: table.id,
    syncKey,
    table,
    binding,
    position: initial,
    position01: initialPos01,
    handle,
    setPosition(value, opts) {
      const clamped = Math.min(max, Math.max(min, value));
      slider.position = clamped;
      slider.position01 = (clamped - min) / (max - min);
      input.value = String(clamped);
      valueSpan.textContent = formatNumber(clamped);
      refreshTableReadouts(table);
      persistPosition(id, slider.position01);
      if (opts?.broadcast !== false) broadcastSync(slider);
    },
    destroy() {
      destroyAxisSlider(slider, ctx);
    },
  };

  sliderRegistry.push(slider);
  refreshTableReadouts(table);
  return slider;
}

export function getSliders(table?: HTMLTableElement): GridSightSlider[] {
  if (!table) return sliderRegistry.slice();
  return sliderRegistry.filter(s => s.table === table);
}

export function removeAllSliders(table?: HTMLTableElement): void {
  const toRemove = table ? sliderRegistry.filter(s => s.table === table) : sliderRegistry.slice();
  for (const s of toRemove) s.destroy();
}

export function registerFormula(
  table: HTMLTableElement,
  fn: (rowValue: number, colValue: number) => number
): void {
  if (typeof fn !== 'function') throw new Error('Formula must be a function');
  formulaRegistry.set(table, fn);
  refreshTableReadouts(table);
}

export function clearFormula(table: HTMLTableElement): void {
  formulaRegistry.delete(table);
  refreshTableReadouts(table);
}

export function onSliderRecompute(cb: () => void): () => void {
  recomputeListeners.add(cb);
  return () => recomputeListeners.delete(cb);
}

export function inspectAxisBinding(table: HTMLTableElement, axis: Axis): AxisBinding | null {
  return buildAxisBinding(table, axis);
}

/** Internal: external slider (e.g. threshold) registration. */
export function registerExternalSlider(slider: GridSightSlider, table: HTMLTableElement): void {
  const internal = slider as InternalSlider;
  internal.table = table;
  internal.binding = null;
  sliderRegistry.push(internal);
}

export function unregisterExternalSlider(slider: GridSightSlider): void {
  const idx = sliderRegistry.indexOf(slider as InternalSlider);
  if (idx >= 0) sliderRegistry.splice(idx, 1);
}
