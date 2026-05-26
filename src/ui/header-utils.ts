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
import {
  registerEnrichment,
  listEnrichmentDescriptors,
  type AffordanceContext,
} from '../core/enrichment-registry';
import { ensureRowVisibilityStyles } from './row-visibility-styles';

export type HeaderType = 'row' | 'column' | 'table';

/* Class names — kept under the existing `gs-plus-icon` namespace for back-compat
 * with stylesheets that target it, but the elements are now lozenge buttons. */
const PLUS_ICON_CLASS = 'gs-plus-icon';
const HEADER_WITH_ICON_CLASS = 'gs-has-plus-icon';
const LOZENGE_CLASS = 'gs-lozenge';
const LOZENGE_ACTIVE_CLASS = 'gs-lozenge--active';

/** Rows/cells the slider enrichment injects carry `data-gs-injected`. Lozenge
 *  placement and column indexing must ignore them so that a column index always
 *  means "position among the original cells" — the same coordinate system the
 *  heatmap, sort, and filter consumers use. Without this, enabling a slider
 *  shifts every header's cell index and the lozenges land on the wrong cells. */
function nonInjectedRows(table: HTMLTableElement): HTMLTableRowElement[] {
  return Array.from(table.rows).filter(r => !r.hasAttribute('data-gs-injected'));
}

function nonInjectedCells(row: HTMLTableRowElement): HTMLTableCellElement[] {
  return Array.from(row.cells).filter(c => !c.hasAttribute('data-gs-injected'));
}

/** Inject the inline lozenge toggles (H/S/#) on every applicable header.
 *  Replaces the previous "+ → dropdown" UX. */
export function injectPlusIcons(table: HTMLTableElement, columnTypes: ColumnType[]): void {
  removePlusIcons(table);
  ensureLozengeStyles();
  ensureRowVisibilityStyles();

  const rows = nonInjectedRows(table);
  const headerRow = rows[0];
  if (!headerRow) return;

  nonInjectedCells(headerRow).forEach((cell, colIndex) => {
    const isTopLeftCell = colIndex === 0;
    const type = columnTypes[colIndex];
    if (type === 'numeric' || type === 'categorical') {
      addLozengesToHeader(table, cell, isTopLeftCell ? 'table' : 'column', colIndex);
    }
  });

  for (let i = 1; i < rows.length; i++) {
    const cells = nonInjectedCells(rows[i]);
    if (!cells.length) continue;
    addLozengesToHeader(table, cells[0], 'row', 0);
  }
}

/** The single enrichment injection pass (docs/architecture/enrichments.md).
 *  Mounts every shipped + enabled + applicable affordance — classic lozenges
 *  and virtual-column lozenges alike — into the per-header cluster. Alias of
 *  `injectPlusIcons`; prefer this name at call sites. */
export const mountEnrichments = injectPlusIcons;

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
  const tbody = table.tBodies[0];
  if (!tbody) return false;
  for (const row of Array.from(tbody.rows)) {
    if (row.hasAttribute('data-gs-injected')) continue;
    const cell = nonInjectedCells(row)[columnIndex];
    if (cell && cell.rowSpan > 1) return true;
  }
  return false;
}

function addLozengesToHeader(
  table: HTMLTableElement,
  header: HTMLTableCellElement,
  type: HeaderType,
  colIndex: number
): void {
  if (header.querySelector(`.${LOZENGE_CLASS}, .${PLUS_ICON_CLASS}`)) return;

  const columnType = inferHeaderColumnType(table, header, type);
  const enabled = getEffectiveEnabledSet();

  // One pass: every shipped + enabled + applicable enrichment descriptor
  // (classic lozenges and virtual columns alike) contributes its affordance.
  // See docs/architecture/enrichments.md.
  const els = buildDescriptorAffordances(table, header, type, colIndex, columnType, enabled);
  if (els.length === 0) return;

  const cluster = document.createElement('span');
  cluster.className = 'gs-lozenge-cluster';
  cluster.style.cssText = 'display:inline-flex; gap:2px; margin-left:6px; vertical-align:middle;';
  for (const el of els) cluster.appendChild(el);

  header.appendChild(cluster);
  header.classList.add(HEADER_WITH_ICON_CLASS);
}

/** Build the affordance elements for every enrichment descriptor that is
 *  shipped, enabled, and applies to this header context. This is the single
 *  injection mechanism — classic lozenges and virtual columns both register
 *  descriptors (docs/architecture/enrichments.md). */
function buildDescriptorAffordances(
  table: HTMLTableElement,
  header: HTMLTableCellElement,
  headerType: HeaderType,
  colIndex: number,
  columnType: ColumnType,
  enabled: ReadonlySet<string>,
): HTMLElement[] {
  if (table.hasAttribute('data-gs-ignore')) return [];
  // The descriptor context only models numeric/categorical columns.
  if (columnType !== 'numeric' && columnType !== 'categorical') return [];
  const ctx: AffordanceContext = {
    table,
    header,
    headerType,
    colIndex,
    columnType,
  };
  const out: HTMLElement[] = [];
  for (const descriptor of listEnrichmentDescriptors()) {
    const behavior = descriptor.behavior;
    if (!descriptor.shipped || !behavior) continue;
    if (!enabled.has(descriptor.id)) continue;
    if (!behavior.appliesTo(ctx)) continue;
    const el = behavior.mount(ctx);
    if (el) out.push(el);
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Classic enrichment descriptors.
 *
 * These were previously an inline `LozengeSpec[]` literal inside
 * `addLozengesToHeader` plus a parallel `ENRICHMENT_ITEMS` list in
 * `enrichment-menu.ts`. They now register against the shared catalog so the
 * single injection pass (and the toggle panel / capability gate) drive them
 * uniformly with the virtual-column descriptors. See
 * docs/architecture/enrichments.md.
 * ────────────────────────────────────────────────────────────────────────── */

registerEnrichment({
  id: 'heatmap',
  appliesTo: (ctx) => ctx.columnType === 'numeric',
  isActive: (ctx) =>
    isCurrentHeatmapActive(ctx.table, ctx.headerType, ctx.header, ctx.colIndex),
  mount: (ctx) =>
    buildLozenge({
      id: 'heatmap',
      label: 'H',
      title: heatmapTitle(ctx.headerType),
      isToggle: true,
      isActive: () =>
        isCurrentHeatmapActive(ctx.table, ctx.headerType, ctx.header, ctx.colIndex),
      onClick: () => {
        applyHeatmapToggle(ctx.table, ctx.headerType, ctx.header, ctx.colIndex);
        refreshLozengeStates(ctx.table);
      },
    }),
});

registerEnrichment({
  id: 'sliders',
  // Sliders come as a row+col pair, so the toggle lives only on the table
  // (top-left corner) cluster, and only when an axis qualifies.
  appliesTo: (ctx) =>
    ctx.columnType === 'numeric' &&
    ctx.headerType === 'table' &&
    sliderApplicable(ctx.table, 'table'),
  isActive: (ctx) => sliderIsActive(ctx.table, ctx.headerType),
  mount: (ctx) =>
    buildLozenge({
      id: 'sliders',
      label: 'S',
      title: sliderTitle(ctx.headerType),
      isToggle: true,
      isActive: () => sliderIsActive(ctx.table, ctx.headerType),
      onClick: () => {
        toggleSliders(ctx.table, ctx.headerType);
        refreshLozengeStates(ctx.table);
      },
    }),
});

registerEnrichment({
  id: 'statistics',
  appliesTo: (ctx) => ctx.columnType === 'numeric',
  mount: (ctx) =>
    buildLozenge({
      id: 'statistics',
      label: '#',
      title: statisticsTitle(ctx.headerType),
      isToggle: false,
      isActive: () => false,
      onClick: () =>
        dispatchEnrichmentEvent(ctx.header, ctx.headerType, 'statistics', ctx.colIndex),
    }),
});

registerEnrichment({
  id: 'frequency',
  // Frequency views only make sense for a single column or row — there is no
  // table-wide frequency.
  appliesTo: (ctx) => ctx.columnType === 'categorical' && ctx.headerType !== 'table',
  mount: (ctx) =>
    buildLozenge({
      id: 'frequency',
      label: '#',
      title: 'Frequency table',
      isToggle: false,
      isActive: () => false,
      onClick: () =>
        dispatchEnrichmentEvent(ctx.header, ctx.headerType, 'frequency', ctx.colIndex),
    }),
});

registerEnrichment({
  id: 'frequency-chart',
  appliesTo: (ctx) => ctx.columnType === 'categorical' && ctx.headerType !== 'table',
  mount: (ctx) =>
    buildLozenge({
      id: 'frequency-chart',
      label: '⟋',
      title: 'Frequency chart',
      isToggle: false,
      isActive: () => false,
      onClick: () =>
        dispatchEnrichmentEvent(ctx.header, ctx.headerType, 'frequency-chart', ctx.colIndex),
    }),
});

registerEnrichment({
  id: 'sort',
  // Column headers only; suppressed by data-gs-no-sort or a rowspan body cell.
  appliesTo: (ctx) =>
    ctx.headerType === 'column' &&
    !ctx.header.hasAttribute('data-gs-no-sort') &&
    !columnHasRowspanBodyCells(ctx.table, ctx.colIndex),
  isActive: (ctx) => {
    const cur = getVisibleRows(ctx.table).sort;
    return !!(cur && cur.columnIndex === ctx.colIndex);
  },
  mount: (ctx) => {
    const columnKey = colKeyAt(ctx.table, ctx.colIndex);
    const type = detectSortColumnType(ctx.table, ctx.colIndex);
    return createSortLozenge({
      columnIndex: ctx.colIndex,
      columnKey,
      columnType: type,
      getCurrentSort: () => getVisibleRows(ctx.table).sort as SortDirective | null,
      onChange: (next) => setSort(ctx.table, next),
    });
  },
});

registerEnrichment({
  id: 'filter',
  appliesTo: (ctx) =>
    ctx.headerType === 'column' &&
    !ctx.header.hasAttribute('data-gs-no-filter') &&
    !columnHasRowspanBodyCells(ctx.table, ctx.colIndex),
  isActive: (ctx) => getVisibleRows(ctx.table).filters.has(ctx.colIndex),
  mount: (ctx) => {
    const columnKey = colKeyAt(ctx.table, ctx.colIndex);
    const colType: 'numeric' | 'categorical' =
      detectSortColumnType(ctx.table, ctx.colIndex) === 'numeric' ? 'numeric' : 'categorical';
    return createFilterLozenge({
      table: ctx.table,
      columnIndex: ctx.colIndex,
      columnKey,
      columnType: colType,
      getCurrentFilter: () =>
        (getVisibleRows(ctx.table).filters.get(ctx.colIndex) as FilterPredicate | undefined) ?? null,
      onChange: (next) => setFilter(ctx.table, ctx.colIndex, next),
    });
  },
});

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
    const headerRow = header.closest('tr');
    if (headerRow) {
      const colIndex = nonInjectedCells(headerRow).indexOf(header);
      const firstDataRow = nonInjectedRows(table)[1];
      const dataCell = firstDataRow ? nonInjectedCells(firstDataRow)[colIndex] : undefined;
      if (dataCell) {
        const value = dataCell.textContent?.trim() ?? '';
        return cleanNumericCell(value) !== null ? 'numeric' : 'categorical';
      }
    }
    return 'categorical';
  }
  if (type === 'row') {
    const row = header.closest('tr');
    if (row) {
      const hasNumeric = nonInjectedCells(row).slice(1).some(cell => {
        const v = cell.textContent?.trim() ?? '';
        return cleanNumericCell(v) !== null;
      });
      return hasNumeric ? 'numeric' : 'categorical';
    }
    return 'categorical';
  }
  // type === 'table'
  const rows = nonInjectedRows(table).slice(1);
  const hasNumeric = rows.some(row =>
    nonInjectedCells(row).some(cell => {
      const v = cell.textContent?.trim() ?? '';
      return cleanNumericCell(v) !== null;
    })
  );
  return hasNumeric ? 'numeric' : 'categorical';
}

function inferHeaderType(header: HTMLTableCellElement): HeaderType {
  const row = header.closest('tr');
  const tbl = header.closest('table');
  if (!row || !tbl) return 'column';
  const isFirstRow = row === tbl.rows[0];
  const isFirstCell = header === row.cells[0];
  if (isFirstRow && isFirstCell) return 'table';
  if (isFirstRow) return 'column';
  return 'row';
}

function headerColIndex(header: HTMLTableCellElement): number {
  const row = header.closest('tr');
  if (!row) return 0;
  return Array.from(row.cells).indexOf(header);
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
    const ri = Array.from(tr.parentElement?.children || []).indexOf(tr);
    return isHeatmapActive(table, ri + 1, 'row');
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
    const ri = Array.from(tr.parentElement?.children || []).indexOf(tr);
    toggleHeatmap(table, ri + 1, 'row');
  } else {
    toggleHeatmap(table, -1, 'table');
  }
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
  const event = new CustomEvent('gridsight:enrichmentSelected', {
    bubbles: true,
    detail: {
      type,
      enrichmentType,
      header,
      headerIndex: type === 'column'
        ? colIndex
        : type === 'row'
          ? Array.from(header.closest('tr')?.parentElement?.children ?? []).indexOf(header.closest('tr') as HTMLTableRowElement)
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
