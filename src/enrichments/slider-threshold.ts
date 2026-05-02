/**
 * Threshold-slider orchestrator. Heatmap variant — see User Story 4.
 * Fades cells whose underlying value is below the slider's current threshold by
 * setting `--gs-cell-fade` on the host container and toggling `gs-threshold-active`.
 */

import { createSliderControl, formatNumber } from '../ui/slider-control';
import { parseHeaderNumber } from '../utils/sync-key';
import { resolveInitialPosition, persistPosition, pruneEntry } from '../utils/slider-persistence';
import type { GridSightSlider } from './slider';
import { registerExternalSlider, unregisterExternalSlider } from './slider';

const FADE_OPACITY = 0.18;

interface ThresholdHandle {
  destroy(): void;
}

const thresholdHandles = new WeakMap<HTMLTableElement, ThresholdHandle>();
const thresholdSliders: { table: HTMLTableElement; slider: GridSightSlider }[] = [];

function readNumericValuesFromTable(table: HTMLTableElement): number[] {
  const out: number[] = [];
  for (let i = 1; i < table.rows.length; i++) {
    const row = table.rows[i];
    for (let j = 1; j < row.cells.length; j++) {
      const t = row.cells[j].textContent?.trim() ?? '';
      const n = parseHeaderNumber(t);
      if (n !== null && isFinite(n)) out.push(n);
    }
  }
  return out;
}

/** Add a threshold slider to a heatmap-coloured table. */
export function addThresholdSlider(table: HTMLTableElement): GridSightSlider {
  if (!table) throw new Error('No table');
  if (!table.id) table.id = `gs-tbl-${Math.random().toString(36).slice(2, 8)}`;

  const hasHeatmap = !!table.querySelector('.gs-heatmap-cell');
  if (!hasHeatmap) throw new Error('Heatmap not enabled');

  if (thresholdHandles.has(table)) {
    throw new Error('Threshold slider already exists');
  }

  const allValues = readNumericValuesFromTable(table);
  if (allValues.length < 2) throw new Error('Heatmap not enabled');
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);

  // Tag every numeric cell with its data-value so we can fade in CSS.
  // Also mark the host container.
  const host = ensureThresholdHost(table);
  for (let i = 1; i < table.rows.length; i++) {
    const row = table.rows[i];
    for (let j = 1; j < row.cells.length; j++) {
      const cell = row.cells[j];
      if (cell.hasAttribute('data-gs-cell-value')) continue;
      const t = cell.textContent?.trim() ?? '';
      const n = parseHeaderNumber(t);
      if (n !== null && isFinite(n)) {
        cell.setAttribute('data-gs-cell-value', String(n));
      }
    }
  }

  const id = `${table.id}#threshold`;
  const initialPos01 = resolveInitialPosition(id);
  const initial = min + initialPos01 * (max - min);

  const applyThreshold = (threshold: number) => {
    host.classList.add('gs-threshold-active');
    for (const cell of host.querySelectorAll<HTMLElement>('[data-gs-cell-value]')) {
      const v = parseFloat(cell.getAttribute('data-gs-cell-value') || 'NaN');
      if (!isFinite(v) || v < threshold) {
        cell.setAttribute('data-gs-cell-fade', '');
        cell.style.opacity = String(FADE_OPACITY);
      } else {
        cell.removeAttribute('data-gs-cell-fade');
        cell.style.opacity = '';
      }
    }
  };

  const handle = createSliderControl({
    id,
    min,
    max,
    initial,
    label: `Threshold (${formatNumber(min)}–${formatNumber(max)})`,
    axis: 'threshold',
    onInput: (v) => {
      slider.position = v;
      slider.position01 = (v - min) / (max - min);
      handle.setInterpolatedReadout(formatNumber(v));
      applyThreshold(v);
      persistPosition(id, slider.position01);
    },
    onChange: (v) => {
      persistPosition(id, (v - min) / (max - min));
    },
  });

  // Insert above the table.
  const parent = table.parentElement || document.body;
  parent.insertBefore(handle.root, table);

  const slider: GridSightSlider = {
    id,
    kind: 'threshold',
    axis: undefined,
    position: initial,
    position01: initialPos01,
    tableId: table.id,
    syncKey: null,
    handle,
    setPosition(value: number) {
      const clamped = Math.min(max, Math.max(min, value));
      slider.position = clamped;
      slider.position01 = (clamped - min) / (max - min);
      handle.setValue(clamped);
      applyThreshold(clamped);
      persistPosition(id, slider.position01);
    },
    destroy() {
      handle.destroy();
      host.classList.remove('gs-threshold-active');
      for (const cell of host.querySelectorAll<HTMLElement>('[data-gs-cell-value]')) {
        cell.removeAttribute('data-gs-cell-fade');
        cell.style.opacity = '';
      }
      thresholdHandles.delete(table);
      const idx = thresholdSliders.findIndex(t => t.table === table);
      if (idx >= 0) thresholdSliders.splice(idx, 1);
      unregisterExternalSlider(slider);
      pruneEntry(id);
    },
  } as GridSightSlider;

  // Apply initial state.
  handle.setInterpolatedReadout(formatNumber(initial));
  applyThreshold(initial);

  thresholdHandles.set(table, { destroy: () => slider.destroy() });
  thresholdSliders.push({ table, slider });
  registerExternalSlider(slider, table);

  return slider;
}

function ensureThresholdHost(table: HTMLTableElement): HTMLElement {
  // Prefer the table itself as the host; the CSS rule scopes to descendants.
  table.classList.add('gs-threshold-host');
  return table;
}

/** Returns the threshold slider for the given table, if any. */
export function getThresholdSlider(table: HTMLTableElement): GridSightSlider | null {
  const entry = thresholdSliders.find(t => t.table === table);
  return entry ? entry.slider : null;
}
