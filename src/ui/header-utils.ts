import type { ColumnType } from '../core/type-detection';
import { cleanNumericCell } from '../core/type-detection';
import { addSlider, getSliders, inspectAxisBinding } from '../enrichments/slider';
import { isHeatmapActive, toggleHeatmap } from '../enrichments/heatmap';
import {
  getVisibleRows,
  setSort,
  setFilter,
  type FilterPredicate,
  type SortDirective,
} from '../utils/visible-rows';
import { colKeyAt } from '../utils/view-state-url';
import { createSortLozenge } from './sort-lozenge';
import { createFilterLozenge } from './filter-lozenge';
import { detectSortColumnType } from '../enrichments/sort';
import { getEffectiveEnabledSet } from '../core/enabled-set-state';
import { ensureRowVisibilityStyles } from './row-visibility-styles';
import {
  gridRows,
  gridCells,
  bodyRows,
  columnCells,
  cellValue,
  logicalColIndexOf,
} from '../core/table-grid';

export type HeaderType = 'row' | 'column' | 'table';

/* Class names — kept under the existing `gs-plus-icon` namespace for back-compat
 * with stylesheets that target it, but the elements are now lozenge buttons. */
const PLUS_ICON_CLASS = 'gs-plus-icon';
const HEADER_WITH_ICON_CLASS = 'gs-has-plus-icon';
const LOZENGE_CLASS = 'gs-lozenge';
const LOZENGE_ACTIVE_CLASS = 'gs-lozenge--active';

/** Inject the inline lozenge toggles (H/S/#) on every applicable header.
 *  Replaces the previous "+ → dropdown" UX. Column/row indexing goes through
 *  the canonical addressing layer so slider scaffolding never displaces a
 *  lozenge (spec 013). */
export function injectPlusIcons(table: HTMLTableElement, columnTypes: ColumnType[]): void {
  removePlusIcons(table);
  ensureLozengeStyles();
  ensureRowVisibilityStyles();

  const rows = gridRows(table);
  const headerRow = rows[0];
  if (!headerRow) return;

  gridCells(headerRow).forEach((cell, colIndex) => {
    const isTopLeftCell = colIndex === 0;
    const type = columnTypes[colIndex];
    if (type === 'numeric' || type === 'categorical') {
      addLozengesToHeader(table, cell, isTopLeftCell ? 'table' : 'column', colIndex);
    }
  });

  for (let i = 1; i < rows.length; i++) {
    const cells = gridCells(rows[i]);
    if (!cells.length) continue;
    addLozengesToHeader(table, cells[0], 'row', 0);
  }
}

export function removePlusIcons(table: HTMLTableElement): void {
  const icons = table.querySelectorAll(`.${PLUS_ICON_CLASS}, .${LOZENGE_CLASS}`);
  icons.forEach(icon => icon.remove());
  // Also remove the empty cluster span that wraps lozenge buttons; otherwise
  // disable() leaves orphan <span class="gs-lozenge-cluster"> elements behind
  // and SC-005 (byte-identical DOM on toggle-off) cannot hold.
  const clusters = table.querySelectorAll('.gs-lozenge-cluster');
  clusters.forEach((c) => c.remove());
  const cells = table.querySelectorAll(`.${HEADER_WITH_ICON_CLASS}`);
  cells.forEach(cell => cell.classList.remove(HEADER_WITH_ICON_CLASS));
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Lozenge cluster                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

interface LozengeSpec {
  id: 'heatmap' | 'sliders' | 'statistics' | 'frequency' | 'frequency-chart' | 'sort' | 'filter';
  label: string;
  title: string;
  /** Toggle (true) or one-shot command (false). Commands have no active state. */
  isToggle: boolean;
  /** Probe current active state. Only meaningful when isToggle. */
  isActive: () => boolean;
  /** Apply the action. */
  onClick: () => void;
}

/** Detect whether a body cell in this column spans more than one row — if so,
 *  sort and filter are suppressed (per spec edge cases). */
function columnHasRowspanBodyCells(table: HTMLTableElement, columnIndex: number): boolean {
  return columnCells(table, columnIndex).some(cell => cell.rowSpan > 1);
}

function addLozengesToHeader(
  table: HTMLTableElement,
  header: HTMLTableCellElement,
  type: HeaderType,
  colIndex: number
): void {
  if (header.querySelector(`.${LOZENGE_CLASS}, .${PLUS_ICON_CLASS}`)) return;

  const columnType = inferHeaderColumnType(table, header, type);

  const specs: LozengeSpec[] = [];

  if (columnType === 'numeric') {
    // H — heatmap toggle
    specs.push({
      id: 'heatmap',
      label: 'H',
      title: heatmapTitle(type),
      isToggle: true,
      isActive: () => isCurrentHeatmapActive(table, type, header, colIndex),
      onClick: () => {
        applyHeatmapToggle(table, type, header, colIndex);
        refreshLozengeStates(table);
      },
    });

    // S — slider toggle. Only relevant table-wide (sliders always come as a
    // row+col pair), so it lives only on the top-left lozenge cluster.
    if (type === 'table' && sliderApplicable(table, type)) {
      specs.push({
        id: 'sliders',
        label: 'S',
        title: sliderTitle(type),
        isToggle: true,
        isActive: () => sliderIsActive(table, type),
        onClick: () => {
          toggleSliders(table, type);
          refreshLozengeStates(table);
        },
      });
    }

    // # — statistics command (popup)
    specs.push({
      id: 'statistics',
      label: '#',
      title: statisticsTitle(type),
      isToggle: false,
      isActive: () => false,
      onClick: () => dispatchEnrichmentEvent(header, type, 'statistics', colIndex),
    });
  } else if (columnType === 'categorical' && type !== 'table') {
    // Categorical headers: frequency lozenges only make sense for a single
    // column or row — there is no table-wide "frequency" view to render.
    specs.push({
      id: 'frequency',
      label: '#',
      title: 'Frequency table',
      isToggle: false,
      isActive: () => false,
      onClick: () => dispatchEnrichmentEvent(header, type, 'frequency', colIndex),
    });
    specs.push({
      id: 'frequency-chart',
      label: '⟋',
      title: 'Frequency chart',
      isToggle: false,
      isActive: () => false,
      onClick: () => dispatchEnrichmentEvent(header, type, 'frequency-chart', colIndex),
    });
  }

  // Sort + filter lozenges live only on column headers (top row, non-table cell).
  // They are suppressed when:
  //  - `data-gs-no-sort` / `data-gs-no-filter` is set on the header
  //  - any body cell in this column has rowspan > 1
  if (type === 'column' && !columnHasRowspanBodyCells(table, colIndex)) {
    if (!header.hasAttribute('data-gs-no-sort')) {
      specs.push(buildSortSpec(table, header, colIndex));
    }
    if (!header.hasAttribute('data-gs-no-filter')) {
      specs.push(buildFilterSpec(table, header, colIndex));
    }
  }

  // Spec 012 (FR-009): drop specs whose id is not in the effective enabled set.
  const enabled = getEffectiveEnabledSet();
  const filteredSpecs = specs.filter(s => enabled.has(s.id));
  if (filteredSpecs.length === 0) return;

  const cluster = document.createElement('span');
  cluster.className = 'gs-lozenge-cluster';
  cluster.style.cssText = 'display:inline-flex; gap:2px; margin-left:6px; vertical-align:middle;';

  for (const spec of filteredSpecs) {
    if (spec.id === 'sort' || spec.id === 'filter') {
      // These specs already carry their own concrete button via `onClick`.
      cluster.appendChild(buildPrebuiltLozenge(spec, table, header, colIndex));
    } else {
      cluster.appendChild(buildLozenge(spec));
    }
  }

  header.appendChild(cluster);
  header.classList.add(HEADER_WITH_ICON_CLASS);
}

function buildSortSpec(
  table: HTMLTableElement,
  _header: HTMLTableCellElement,
  colIndex: number
): LozengeSpec {
  return {
    id: 'sort',
    label: '↕',
    title: 'Sort column',
    isToggle: true,
    isActive: () => {
      const cur = getVisibleRows(table).sort;
      return !!(cur && cur.columnIndex === colIndex);
    },
    onClick: () => {/* handled in buildPrebuiltLozenge */},
  };
}

function buildFilterSpec(
  table: HTMLTableElement,
  _header: HTMLTableCellElement,
  colIndex: number
): LozengeSpec {
  return {
    id: 'filter',
    label: '▽',
    title: 'Filter column',
    isToggle: true,
    isActive: () => getVisibleRows(table).filters.has(colIndex),
    onClick: () => {/* handled in buildPrebuiltLozenge */},
  };
}

function buildPrebuiltLozenge(
  spec: LozengeSpec,
  table: HTMLTableElement,
  _header: HTMLTableCellElement,
  colIndex: number
): HTMLButtonElement {
  const columnKey = colKeyAt(table, colIndex);
  if (spec.id === 'sort') {
    const type = detectSortColumnType(table, colIndex);
    return createSortLozenge({
      columnIndex: colIndex,
      columnKey,
      columnType: type,
      getCurrentSort: () => getVisibleRows(table).sort as SortDirective | null,
      onChange: (next) => setSort(table, next),
    });
  }
  // filter
  const colType: 'numeric' | 'categorical' =
    detectSortColumnType(table, colIndex) === 'numeric' ? 'numeric' : 'categorical';
  return createFilterLozenge({
    table,
    columnIndex: colIndex,
    columnKey,
    columnType: colType,
    getCurrentFilter: () => (getVisibleRows(table).filters.get(colIndex) as FilterPredicate | undefined) ?? null,
    onChange: (next) => setFilter(table, colIndex, next),
  });
}

function buildLozenge(spec: LozengeSpec): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = LOZENGE_CLASS;
  btn.textContent = spec.label;
  btn.title = spec.title;
  btn.setAttribute('aria-label', spec.title);
  btn.setAttribute('data-gs-lozenge-id', spec.id);
  if (spec.isToggle) {
    btn.setAttribute('role', 'switch');
    const active = spec.isActive();
    btn.setAttribute('aria-checked', String(active));
    if (active) btn.classList.add(LOZENGE_ACTIVE_CLASS);
  }
  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    spec.onClick();
  });
  return btn;
}

/** Re-evaluate every lozenge's active state on this table. Called after any
 *  toggle so adjacent lozenges (e.g. row-axis slider after table-wide toggle)
 *  reflect the new state. */
function refreshLozengeStates(table: HTMLTableElement): void {
  const lozenges = table.querySelectorAll<HTMLButtonElement>(`.${LOZENGE_CLASS}`);
  lozenges.forEach((btn) => {
    const id = btn.getAttribute('data-gs-lozenge-id');
    if (!id) return;
    const header = btn.closest('th, td') as HTMLTableCellElement | null;
    if (!header) return;
    const type = inferHeaderType(header);
    if (id === 'heatmap') {
      const colIndex = headerColIndex(header);
      const active = isCurrentHeatmapActive(table, type, header, colIndex);
      btn.classList.toggle(LOZENGE_ACTIVE_CLASS, active);
      btn.setAttribute('aria-checked', String(active));
    } else if (id === 'sliders') {
      const active = sliderIsActive(table, type);
      btn.classList.toggle(LOZENGE_ACTIVE_CLASS, active);
      btn.setAttribute('aria-checked', String(active));
    }
  });
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function inferHeaderColumnType(
  table: HTMLTableElement,
  header: HTMLTableCellElement,
  type: HeaderType
): ColumnType {
  if (type === 'column') {
    const colIndex = logicalColIndexOf(header);
    if (colIndex >= 0) {
      const dataCell = columnCells(table, colIndex)[0];
      if (dataCell) {
        return cleanNumericCell(cellValue(dataCell)) !== null ? 'numeric' : 'categorical';
      }
    }
    return 'categorical';
  }
  if (type === 'row') {
    const row = header.closest('tr') as HTMLTableRowElement | null;
    if (row) {
      const hasNumeric = gridCells(row).slice(1).some(cell =>
        cleanNumericCell(cellValue(cell)) !== null
      );
      return hasNumeric ? 'numeric' : 'categorical';
    }
    return 'categorical';
  }
  // type === 'table'
  const hasNumeric = bodyRows(table).some(row =>
    gridCells(row).some(cell => cleanNumericCell(cellValue(cell)) !== null)
  );
  return hasNumeric ? 'numeric' : 'categorical';
}

function inferHeaderType(header: HTMLTableCellElement): HeaderType {
  const row = header.closest('tr') as HTMLTableRowElement | null;
  const tbl = header.closest('table') as HTMLTableElement | null;
  if (!row || !tbl) return 'column';
  const isFirstRow = row === gridRows(tbl)[0];
  const isFirstCell = header === gridCells(row)[0];
  if (isFirstRow && isFirstCell) return 'table';
  if (isFirstRow) return 'column';
  return 'row';
}

function headerColIndex(header: HTMLTableCellElement): number {
  const idx = logicalColIndexOf(header);
  return idx < 0 ? 0 : idx;
}

function heatmapTitle(type: HeaderType): string {
  if (type === 'table') return 'Heatmap (table)';
  if (type === 'column') return 'Heatmap (column)';
  return 'Heatmap (row)';
}

function sliderTitle(type: HeaderType): string {
  if (type === 'table') return 'Toggle row + column sliders';
  if (type === 'column') return 'Toggle column slider';
  return 'Toggle row slider';
}

function statisticsTitle(type: HeaderType): string {
  if (type === 'table') return 'Statistics (table)';
  if (type === 'column') return 'Statistics (column)';
  return 'Statistics (row)';
}

function isCurrentHeatmapActive(
  table: HTMLTableElement,
  type: HeaderType,
  header: HTMLTableCellElement,
  colIndex: number
): boolean {
  if (type === 'column') return isHeatmapActive(table, colIndex, 'column');
  if (type === 'row') {
    const tr = header.closest('tr') as HTMLTableRowElement | null;
    if (!tr) return false;
    return isHeatmapActive(table, heatmapRowIndex(table, tr), 'row');
  }
  return isHeatmapActive(table, -1, 'table');
}

function applyHeatmapToggle(
  table: HTMLTableElement,
  type: HeaderType,
  header: HTMLTableCellElement,
  colIndex: number
): void {
  if (type === 'column') {
    toggleHeatmap(table, colIndex, 'column');
  } else if (type === 'row') {
    const tr = header.closest('tr') as HTMLTableRowElement | null;
    if (!tr) return;
    toggleHeatmap(table, heatmapRowIndex(table, tr), 'row');
  } else {
    toggleHeatmap(table, -1, 'table');
  }
}

/** 1-based body-row position used as the heatmap "row" key. Derived from
 *  bodyRows so slider scaffolding never shifts it; matches the index
 *  `heatmap.ts::collectRowCells` resolves via `bodyRows[index - 1]`. */
function heatmapRowIndex(table: HTMLTableElement, tr: HTMLTableRowElement): number {
  return bodyRows(table).indexOf(tr) + 1;
}

function sliderApplicable(table: HTMLTableElement, type: HeaderType): boolean {
  if (type === 'column') return inspectAxisBinding(table, 'col') !== null;
  if (type === 'row') return inspectAxisBinding(table, 'row') !== null;
  // Table-wide: at least one axis must qualify.
  return inspectAxisBinding(table, 'row') !== null || inspectAxisBinding(table, 'col') !== null;
}

function sliderIsActive(table: HTMLTableElement, type: HeaderType): boolean {
  if (type === 'column') return getSliders(table).some(s => s.kind === 'axis' && s.axis === 'col');
  if (type === 'row') return getSliders(table).some(s => s.kind === 'axis' && s.axis === 'row');
  return getSliders(table).some(s => s.kind === 'axis');
}

function toggleSliders(table: HTMLTableElement, type: HeaderType): void {
  const axes: Array<'row' | 'col'> = type === 'row'
    ? ['row']
    : type === 'column'
      ? ['col']
      : (() => {
          const out: Array<'row' | 'col'> = [];
          if (inspectAxisBinding(table, 'row')) out.push('row');
          if (inspectAxisBinding(table, 'col')) out.push('col');
          return out;
        })();

  // Determine current state across the affected axes.
  const allActive = axes.every(a =>
    getSliders(table).some(s => s.kind === 'axis' && s.axis === a));
  if (allActive) {
    // Remove the affected axes only.
    for (const a of axes) {
      for (const s of getSliders(table).filter(s => s.kind === 'axis' && s.axis === a)) {
        s.destroy();
      }
    }
  } else {
    for (const a of axes) {
      const exists = getSliders(table).some(s => s.kind === 'axis' && s.axis === a);
      if (!exists) {
        try { addSlider(table, a); } catch (e) { console.warn(e); }
      }
    }
  }
}

function dispatchEnrichmentEvent(
  header: HTMLTableCellElement,
  type: HeaderType,
  enrichmentType: string,
  colIndex: number
): void {
  const table = header.closest('table') as HTMLTableElement | null;
  const event = new CustomEvent('gridsight:enrichmentSelected', {
    bubbles: true,
    detail: {
      type,
      enrichmentType,
      header,
      headerIndex: type === 'column'
        ? colIndex
        : type === 'row' && table
          ? bodyRows(table).indexOf(header.closest('tr') as HTMLTableRowElement)
          : 0,
    },
  });
  header.dispatchEvent(event);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Styles                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

let lozengeStylesInjected = false;
function ensureLozengeStyles(): void {
  if (lozengeStylesInjected || typeof document === 'undefined') return;
  if (document.head.querySelector('style[data-gs-lozenge-styles]')) {
    lozengeStylesInjected = true;
    return;
  }
  const style = document.createElement('style');
  style.setAttribute('data-gs-lozenge-styles', '');
  style.textContent = `
    .${LOZENGE_CLASS} {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 6px;
      margin: 0;
      font: 600 11px/1 system-ui, sans-serif;
      color: #555;
      background: #f0f0f0;
      border: 1px solid #d0d0d0;
      border-radius: 9px;
      cursor: pointer;
      user-select: none;
      transition: background-color 100ms, color 100ms, border-color 100ms;
    }
    .${LOZENGE_CLASS}:hover { background: #e0e0e0; color: #222; border-color: #aaa; }
    .${LOZENGE_CLASS}:focus-visible { outline: 2px solid #1976d2; outline-offset: 1px; }
    .${LOZENGE_ACTIVE_CLASS}, .${LOZENGE_CLASS}.${LOZENGE_ACTIVE_CLASS} {
      background: #1976d2; color: #fff; border-color: #1976d2;
    }
    .${LOZENGE_ACTIVE_CLASS}:hover { background: #1565c0; border-color: #1565c0; color: #fff; }
    .gs-lozenge-cluster { white-space: nowrap; }
  `;
  document.head.appendChild(style);
  lozengeStylesInjected = true;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Compatibility shims                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

/** Legacy export — historically the plus-icon styles were injected via this
 *  string by `toggle-injector.ts`. Keep it (empty) so existing imports don't
 *  break; lozenge styles are injected by `ensureLozengeStyles` above. */
export const plusIconStyles = '';
