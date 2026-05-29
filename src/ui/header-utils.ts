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
import { createOutlierLozenge } from './outlier-lozenge';
import { openOutlierPopup } from './outlier-popup';
import {
  getOutlierThreshold,
  setOutlierThreshold,
  getOutlierMarks,
  qualifiesForOutliers,
  isColumnInert,
} from '../enrichments/outlier';
import { detectSortColumnType } from '../enrichments/sort';
import { getEffectiveEnabledSet } from '../core/enabled-set-state';
import {
  registerEnrichment,
  listEnrichmentDescriptors,
  type AffordanceContext,
} from '../core/enrichment-registry';
import { ensureRowVisibilityStyles } from './row-visibility-styles';
import { ensureVirtualColumnStyles } from './virtual-column-styles';
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
const LOZENGE_DISABLED_CLASS = 'gs-lozenge--disabled';

/** Inject the inline lozenge toggles (H/S/#) on every applicable header.
 *  Replaces the previous "+ → dropdown" UX. Column/row indexing goes through
 *  the canonical addressing layer so slider scaffolding never displaces a
 *  lozenge (spec 013). */
export function injectPlusIcons(table: HTMLTableElement, columnTypes: ColumnType[]): void {
  removePlusIcons(table);
  ensureLozengeStyles();
  ensureRowVisibilityStyles();
  ensureVirtualColumnStyles();

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
  /** Render in a non-interactive disabled state (e.g. an enrichment that is
   *  enabled but does not apply to this table). The button stays focusable
   *  (via `aria-disabled`, not the native attribute) so keyboard users can read
   *  `disabledReason`. */
  disabled?: boolean;
  /** Tooltip/accessible-name explaining why the lozenge is disabled. */
  disabledReason?: string;
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
  // (top-left corner) cluster. It mounts whenever the enrichment is enabled; if
  // no axis qualifies it renders disabled with an explanatory tooltip rather
  // than vanishing (so the corner always shows why sliders are unavailable).
  appliesTo: (ctx) => ctx.headerType === 'table',
  isActive: (ctx) => sliderIsActive(ctx.table, ctx.headerType),
  mount: (ctx) => {
    if (!sliderApplicable(ctx.table, 'table')) {
      return buildLozenge({
        id: 'sliders',
        label: 'S',
        title: sliderTitle(ctx.headerType),
        isToggle: false,
        isActive: () => false,
        onClick: () => {},
        disabled: true,
        disabledReason:
          'Sliders need a numeric, monotonic row or column axis — none in this table',
      });
    }
    return buildLozenge({
      id: 'sliders',
      label: 'S',
      title: sliderTitle(ctx.headerType),
      isToggle: true,
      isActive: () => sliderIsActive(ctx.table, ctx.headerType),
      onClick: () => {
        toggleSliders(ctx.table, ctx.headerType);
        refreshLozengeStates(ctx.table);
      },
    });
  },
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

registerEnrichment({
  id: 'outlier',
  // Numeric column headers only; suppressed by data-gs-no-outlier (table or
  // header), a rowspan body cell, or < 3 numeric cells (FR-002/FR-010/FR-022).
  appliesTo: (ctx) =>
    ctx.headerType === 'column' &&
    ctx.columnType === 'numeric' &&
    !ctx.table.hasAttribute('data-gs-no-outlier') &&
    !ctx.header.hasAttribute('data-gs-no-outlier') &&
    !columnHasRowspanBodyCells(ctx.table, ctx.colIndex) &&
    qualifiesForOutliers(ctx.table, ctx.colIndex),
  isActive: (ctx) => getOutlierThreshold(ctx.table, ctx.colIndex) !== null,
  mount: (ctx) => {
    const columnKey = colKeyAt(ctx.table, ctx.colIndex);
    const columnLabel = cellValue(ctx.header) || `Column ${ctx.colIndex + 1}`;
    const inert = isColumnInert(ctx.table, ctx.colIndex);
    let popupDispose: (() => void) | null = null;
    const el = createOutlierLozenge({
      columnIndex: ctx.colIndex,
      columnKey,
      inert,
      columnLabel,
      getCurrent: () => getOutlierThreshold(ctx.table, ctx.colIndex),
      onChange: (next) => {
        setOutlierThreshold(ctx.table, ctx.colIndex, next);
        if (next === null && popupDispose) popupDispose();
      },
      onShowList: () => {
        // Second activation of the affordance closes the open popup (FR-014).
        if (popupDispose) {
          popupDispose();
          return;
        }
        const threshold = getOutlierThreshold(ctx.table, ctx.colIndex);
        if (threshold === null) return;
        const anchor =
          el.querySelector<HTMLElement>('[data-gs-lozenge-id="outlier"]') ?? el;
        popupDispose = openOutlierPopup({
          table: ctx.table,
          columnIndex: ctx.colIndex,
          columnLabel,
          threshold,
          anchor,
          getMarks: () => getOutlierMarks(ctx.table, ctx.colIndex),
          onClose: () => {
            popupDispose = null;
          },
        });
      },
    });
    return el;
  },
});

function buildLozenge(spec: LozengeSpec): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = LOZENGE_CLASS;
  btn.textContent = spec.label;
  btn.setAttribute('data-gs-lozenge-id', spec.id);

  if (spec.disabled) {
    // Enabled-but-not-applicable: shown greyed with an explanatory tooltip.
    // Uses aria-disabled (not the native attribute) so it remains Tab-reachable
    // and the reason is announced; the click is a no-op.
    const why = spec.disabledReason ?? spec.title;
    btn.classList.add(LOZENGE_DISABLED_CLASS);
    btn.setAttribute('aria-disabled', 'true');
    btn.title = why;
    btn.setAttribute('aria-label', why);
    btn.addEventListener('click', (ev) => ev.stopPropagation());
    return btn;
  }

  btn.title = spec.title;
  btn.setAttribute('aria-label', spec.title);
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
    if (btn.getAttribute('aria-disabled') === 'true') return; // not interactive
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
    .${LOZENGE_DISABLED_CLASS}, .${LOZENGE_CLASS}.${LOZENGE_DISABLED_CLASS} {
      opacity: 0.5; cursor: not-allowed; background: #f2f2f2; color: #999; border-color: #e2e2e2;
    }
    .${LOZENGE_DISABLED_CLASS}:hover { background: #f2f2f2; color: #999; border-color: #e2e2e2; }
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
