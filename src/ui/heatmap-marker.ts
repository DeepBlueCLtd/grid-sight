/**
 * Heatmap position-marker overlay.
 * Renders a `[data-gs-marker]` element absolutely positioned at the interpolated
 * (row, col) coordinates of the table whenever both axis sliders are present.
 */

import { onSliderRecompute, getSliders } from '../enrichments/slider';
import type { GridSightSlider } from '../enrichments/slider';
import { locateSpan } from '../utils/segment';

const markerByTable = new WeakMap<HTMLTableElement, HTMLElement>();
let listenerAttached = false;

function findOrCreateMarker(table: HTMLTableElement): HTMLElement {
  let m = markerByTable.get(table);
  if (m?.isConnected) return m;
  m = document.createElement('div');
  m.setAttribute('data-gs-marker', '');
  m.setAttribute('aria-hidden', 'true');
  // Position marker against the table's offsetParent — the table itself becomes the
  // positioning context if it is `position: relative`.
  ensureRelativePositioning(table);
  table.parentElement!.appendChild(m);
  markerByTable.set(table, m);
  return m;
}

function ensureRelativePositioning(table: HTMLTableElement): void {
  const parent = table.parentElement;
  if (!parent) return;
  const cs = getComputedStyle(parent);
  if (cs.position === 'static') {
    parent.style.position = 'relative';
  }
}

function removeMarker(table: HTMLTableElement): void {
  const m = markerByTable.get(table);
  if (m?.isConnected) m.remove();
  markerByTable.delete(table);
}

/** Compute marker pixel position relative to the table, given row/col sliders. */
function computeMarkerPosition(
  table: HTMLTableElement,
  rowSlider: GridSightSlider,
  colSlider: GridSightSlider
): { left: number; top: number } | null {
  if (!rowSlider.handle || !colSlider.handle) return null;
  const rowBinding = (rowSlider as any).binding;
  const colBinding = (colSlider as any).binding;
  if (!rowBinding || !colBinding) return null;

  // Locate the row index spanning the row slider position.
  const ri = locateSpan(rowBinding.headerValues, rowSlider.position);
  const ci = locateSpan(colBinding.headerValues, colSlider.position);
  if (ri < 0 || ci < 0) return null;

  // The slider injects rows/cells (`data-gs-injected`). Walk the table by
  // filtering those out so our (ri, ci) indices into the binding's
  // headerValues map cleanly onto DOM cells.
  const originalRows = Array.from(table.rows).filter(r => !r.hasAttribute('data-gs-injected'));
  // originalRows[0] = column-header row; data rows start at originalRows[1].
  const r0Row = originalRows[ri + 1];
  const r1Row = originalRows[ri + 2];
  if (!r0Row || !r1Row) return null;
  const cellsR0 = Array.from(r0Row.cells).filter(c => !c.hasAttribute('data-gs-injected'));
  const cellsR1 = Array.from(r1Row.cells).filter(c => !c.hasAttribute('data-gs-injected'));
  // cells[0] = row-header; data cells start at cells[1].
  const r0c0 = cellsR0[ci + 1] as HTMLElement;
  const r0c1 = cellsR0[ci + 2] as HTMLElement;
  const r1c0 = cellsR1[ci + 1] as HTMLElement;
  const r1c1 = cellsR1[ci + 2] as HTMLElement;
  if (!r0c0 || !r0c1 || !r1c0 || !r1c1) return null;

  const tableRect = table.parentElement!.getBoundingClientRect();
  const r0c0Rect = r0c0.getBoundingClientRect();
  const r1c1Rect = r1c1.getBoundingClientRect();

  const rowVal0 = rowBinding.headerValues[ri];
  const rowVal1 = rowBinding.headerValues[ri + 1];
  const colVal0 = colBinding.headerValues[ci];
  const colVal1 = colBinding.headerValues[ci + 1];

  const tr = rowVal1 === rowVal0 ? 0 : (rowSlider.position - rowVal0) / (rowVal1 - rowVal0);
  const tc = colVal1 === colVal0 ? 0 : (colSlider.position - colVal0) / (colVal1 - colVal0);

  const xLeftCenter = r0c0Rect.left + r0c0Rect.width / 2;
  const xRightCenter = r1c1Rect.left + r1c1Rect.width / 2;
  const yTopCenter = r0c0Rect.top + r0c0Rect.height / 2;
  const yBottomCenter = r1c1Rect.top + r1c1Rect.height / 2;

  const px = xLeftCenter + tc * (xRightCenter - xLeftCenter);
  const py = yTopCenter + tr * (yBottomCenter - yTopCenter);

  return { left: px - tableRect.left, top: py - tableRect.top };
}


type MarkerEntry = { row: GridSightSlider | null; col: GridSightSlider | null };

function groupAxisSlidersByTable(): Map<HTMLTableElement, MarkerEntry> {
  const tables = new Map<HTMLTableElement, MarkerEntry>();
  for (const s of getSliders()) {
    if (s.kind !== 'axis') continue;
    const tbl = (s as any).table as HTMLTableElement | undefined;
    if (!tbl) continue;
    const entry = tables.get(tbl) ?? { row: null, col: null };
    if (s.axis === 'row') entry.row = s;
    if (s.axis === 'col') entry.col = s;
    tables.set(tbl, entry);
  }
  return tables;
}

function placeMarkerAt(marker: HTMLElement, pos: { left: number; top: number } | null): void {
  if (!pos) {
    marker.style.display = 'none';
    return;
  }
  marker.style.left = pos.left + 'px';
  marker.style.top = pos.top + 'px';
  marker.style.display = '';
}

function refreshTableMarker(table: HTMLTableElement, entry: MarkerEntry): void {
  if (!entry.row || !entry.col) {
    removeMarker(table);
    return;
  }
  const marker = findOrCreateMarker(table);
  placeMarkerAt(marker, computeMarkerPosition(table, entry.row, entry.col));
}

/** Refresh the marker for every table that has both axis sliders. */
function refreshAllMarkers(): void {
  const tables = groupAxisSlidersByTable();
  for (const [table, entry] of tables) refreshTableMarker(table, entry);
}

/** Initialise the marker subsystem. Idempotent — safe to call repeatedly. */
export function ensureHeatmapMarkerListener(): void {
  if (listenerAttached) return;
  listenerAttached = true;
  onSliderRecompute(refreshAllMarkers);
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', refreshAllMarkers);
  }
}

/** Programmatic refresh — exposed for tests. */
export function refreshHeatmapMarkers(): void {
  refreshAllMarkers();
}
