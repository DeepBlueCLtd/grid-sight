/**
 * Grid-Sight - Table Enrichment Library
 * 
 * This library automatically scans for and enriches HTML tables on page load.
 * It provides a simple API for table processing and enrichment.
 */

// Import core modules
import { processTable } from './core/table-processor';
import type { TableProcessorOptions } from './core/table-processor';
import { detectColumnTypes, extractTableData } from './core/type-detection';

// Define HeatmapOptions interface since it's not exported from heatmap.ts
interface HeatmapOptions {
  minValue?: number;
  maxValue?: number;
  colorScale?: string[];
}

// Import enrichments
import { 
  applyHeatmap, 
  removeHeatmap, 
  toggleHeatmap, 
  isHeatmapActive
} from './enrichments/heatmap';

// Import UI components
import { injectToggle, activateToggle } from './ui/toggle-injector';
import { removePlusIcons, refreshLozengeStates } from './ui/header-utils';

// Row-visibility pipeline (spec 002-003-row-visibility)
import { teardown as teardownVisibleRows, hydrateTable, serialiseTable, onVisibleRowsChange } from './utils/visible-rows';
import './enrichments/sort'; // side-effect: registers comparator factory
import { predicateFromDirective } from './enrichments/filter';
import { mountFilterChip, unmountFilterChip } from './enrichments/filter-chip';
import {
  readViewStateFromHash,
  commitViewStateToLocation,
} from './utils/view-state-url';

// Import slider feature (spec 001-dynamic-sliders)
import {
  addSlider as sliderAddSlider,
  getSliders as sliderGetSliders,
  removeAllSliders as sliderRemoveAllSliders,
  registerFormula as sliderRegisterFormula,
  clearFormula as sliderClearFormula,
} from './enrichments/slider';
import type { GridSightSlider, Axis as SliderAxis } from './enrichments/slider';
import { addThresholdSlider as sliderAddThresholdSlider } from './enrichments/slider-threshold';
import { disableTwinSliders } from './enrichments/twin-slider';
import { ensureHeatmapMarkerListener } from './ui/heatmap-marker';

// Virtual columns (spec 012-virtual-columns)
import {
  activateDirective as vcActivate,
  removeDirective as vcRemove,
  detachAll as vcDetachAll,
  restoreFromUrl as vcRestoreFromUrl,
  setPersistOptions as vcSetPersistOptions,
  listDirectives as vcListDirectives,
  removeAllDirectivesOnTable as vcRemoveAllOnTable,
  registerVirtualColumn,
} from './enrichments/virtual-column';
// Side-effect import: registers the virtual-column enrichment descriptors
// (cumulative / sparkline / compare) so the single injection pass in
// header-utils mounts and capability-gates them like every other enrichment.
import './ui/virtual-column-lozenges';
// Side-effect imports register renderers
import './enrichments/cumulative-column';
import './enrichments/sparkline-column';
import './enrichments/compare-column';
import type {
  CompareDirective,
  CumulativeDirective,
  SparklineDirective,
  VirtualColumnKind,
} from './types/virtual-column';

// Note: registerVirtualColumn and the virtual-column type names are reachable
// for ESM consumers via direct imports from ./enrichments/virtual-column and
// ./types/virtual-column. They are intentionally NOT re-exported here.
//
// ⚠ Do not add named top-level exports to this file. The IIFE bundle wrapper
// in vite.config.ts (intro/outro + extend:true) silently corrupts
// `window.gridSight` to `undefined` the moment a named export forces rollup
// into the `this.gridSight = this.gridSight || {}` wrapper. See the comment
// at vite.config.ts:rollupOptions.output and
// specs/012-virtual-columns/research.md §R-13.
void registerVirtualColumn;

// Spec 012 — capability filtering
import { ENRICHMENT_IDS } from './core/enrichment-registry';
import { parsePageConfig } from './core/page-config';
import {
  setPageConfig,
  setVisitorOverride,
  isEnrichmentEnabled,
  resolveTableConfig,
} from './core/enabled-set-state';
import { resolveVisitorEnrichments } from './utils/slider-persistence';
import { clearColumnTypes } from './core/column-types-cache';
import { mountTogglePanel } from './ui/toggle-panel';

// Cell annotations (spec 006-cell-annotations)
import { applyAnnotations, tearDownAnnotations, consumeNavigationHint } from './enrichments/annotations';
import { registerAnnotationsMenuEntry } from './ui/annotation-popup';

// Outlier marker enrichment (spec 004-outlier)
import { applyOutliers, tearDownOutliers } from './enrichments/outlier';

// Navigation & analysis tier 1 (spec 014-navigation-and-analysis)
import { applyFreezePanes, removeFreezePanes } from './enrichments/freeze-panes';
import { applySummaryRow, removeSummaryRow } from './enrichments/summary-row';
// Side-effect: registers the find-in-table corner-lozenge behavior.
import './ui/find-in-table-box';
import { removeFindUi } from './enrichments/find-in-table';
// Side-effect: registers the copy-as-csv corner-lozenge behavior (spec 009).
import './ui/copy-csv-lozenge';

// Internal InitOptions type. Not exported — see ⚠ note above and
// specs/012-virtual-columns/research.md §R-13.
interface InitOptions extends TableProcessorOptions {
  enrichments?: readonly string[];
  showToggleUi?: boolean;
  /** Per-table options (spec 015); rides on the existing config object. */
  tables?: readonly unknown[];
  virtualColumns?: { enabled?: boolean; persistInUrl?: boolean; urlParam?: string };
}

// Activate the heatmap-marker listener once at module load. It is a no-op if no
// dual-axis sliders are ever added.
ensureHeatmapMarkerListener();

/**
 * Spec 015 per-table auto-activate (v1 subset). Apply a parameterless toggle
 * enrichment on a table whose GS toggle is already active. Only the three
 * parameterless toggles are supported; any other id is a no-op here — sort /
 * filter / outlier / cumulative / compare need parameters, statistics /
 * frequency / find are one-shot popups, and summary-row / freeze-panes /
 * annotations already auto-render when enabled.
 */
function autoApplyEnrichment(table: HTMLTableElement, id: string): void {
  try {
    if (id === 'heatmap') {
      if (!isHeatmapActive(table, -1, 'table')) toggleHeatmap(table, -1, 'table');
    } else if (id === 'sliders') {
      for (const axis of ['row', 'col'] as const) {
        try { sliderAddSlider(table, axis); } catch (e) { void e; /* axis not numeric / already present */ }
      }
    } else if (id === 'sparkline') {
      const directive: SparklineDirective = {
        id: 'spark', kind: 'sparkline', tableEl: table, scale: 'per-row', style: 'bar',
      };
      vcActivate(directive);
    }
  } catch (e) {
    console.warn(`[gridsight] auto-activate "${id}" failed:`, e);
  }
}

// Re-export types for external use
export type { 
  TableProcessorOptions, 
  HeatmapOptions 
};

/**
 * The main GridSight API object that will be exposed to the window
 */
// Table state management
const tableRegistry = new Map<string, HTMLTableElement>();

/**
 * The main GridSight API object that will be exposed to the window
 */
const GridSight = {
  /**
   * Version of the library
   */
  version: '0.1.0',
  
  /**
   * Initialize Grid-Sight on all valid tables in the document
   */
  init(options: InitOptions = {}) {
    // Spec 012-capability-filtering: read page-level enrichment config
    // (window.gridSight.pageConfig) and merge any per-field overrides from
    // `options`. Per-field precedence — `options` wins, then `pageConfig`,
    // then library defaults.
    const w = typeof window !== 'undefined'
      ? (window as Window & { gridSight?: { pageConfig?: unknown } })
      : undefined;
    const rawPageConfig = w?.gridSight?.pageConfig;
    const parsedPage = parsePageConfig(rawPageConfig);
    const merged = {
      enrichments: options.enrichments !== undefined
        ? parsePageConfig({ enrichments: options.enrichments }).enrichments
        : parsedPage.enrichments,
      showToggleUi: options.showToggleUi !== undefined
        ? !!options.showToggleUi
        : parsedPage.showToggleUi,
      // Per-table options (spec 015) ride on the existing config object; an
      // ESM `init({ tables })` override takes precedence over pageConfig.tables.
      tables: options.tables !== undefined
        ? parsePageConfig({ tables: options.tables }).tables
        : parsedPage.tables,
    };
    setPageConfig(merged);

    // Visitor override (URL > localStorage). Resets to undefined when neither
    // is present so the resolver falls back to the page config.
    setVisitorOverride(resolveVisitorEnrichments());


    // Find all tables that have at least two rows.
    // Honour `data-gs-ignore`: tables marked with this attribute are left
    // untouched (no GS toggle, no lozenges) — useful for "before" reference
    // tables on demo pages.
    const vcOpts = options.virtualColumns ?? {};
    const vcEnabled = vcOpts.enabled !== false;
    vcSetPersistOptions({
      enabled: vcOpts.persistInUrl !== false,
      urlParam: vcOpts.urlParam,
    });

    const processed: HTMLTableElement[] = [];
    document.querySelectorAll<HTMLTableElement>('table').forEach((table, index) => {
      if (table.hasAttribute('data-gs-ignore')) return;
      if (!this.isValidTable(table)) {
        console.warn(`Skipping invalid table at index ${index}: Table must have at least two rows`);
        return;
      }
      try {
        this.processTable(table, {
          id: `table-${index}`,
          ...options,
        });
        // Virtual-column lozenges are now mounted by the single enrichment
        // injection pass (header-utils.mountEnrichments), on GS-enable, gated
        // by capability — no separate init-time injection. See
        // docs/architecture/enrichments.md.
        processed.push(table);
      } catch (error) {
        console.error(`Failed to process table ${index}:`, error);
      }
    });

    if (vcEnabled) {
      try { vcRestoreFromUrl(processed); } catch (e) { console.warn('virtual-column URL restore failed', e); }
    }

    // Annotations: surface the cross-document menu entry (gated on existence)
    // and consume any transient `#gs.annot=` deep-link hint once tables exist.
    try { registerAnnotationsMenuEntry(); } catch (e) { void e; }
    try { consumeNavigationHint(); } catch (e) { void e; }

    // Mount the runtime toggle panel if the page opted in via either the
    // `showToggleUi` flag or a `[data-gs-toggle-panel]` element on the page.
    if (typeof document !== 'undefined') {
      const explicitContainer = document.querySelector<HTMLElement>('[data-gs-toggle-panel]');
      if (merged.showToggleUi || explicitContainer) {
        try {
          mountTogglePanel(explicitContainer ?? undefined, { tables: tableRegistry });
        } catch (e) {
          console.warn('[gridsight] mountTogglePanel failed:', e);
        }
      }
    }


    return this;
  },

  /**
   * Tear down all Grid-Sight enrichments on the page: remove sliders, heatmaps,
   * the GS toggle on every registered table, lozenges, and clear the registry.
   * Idempotent — safe to call when nothing is attached.
   */
  disable() {
    sliderRemoveAllSliders();
    try { vcDetachAll(); } catch (e) { /* ignore */ void e; }
    for (const table of Array.from(tableRegistry.values())) {
      try { removeHeatmap(table); } catch (e) { /* ignore */ void e; }
      try { disableTwinSliders(table); } catch (e) { /* ignore */ void e; }
      const toggle = table.querySelector('.grid-sight-toggle-container');
      if (toggle) toggle.remove();
      try { unmountFilterChip(table); } catch (e) { /* ignore */ void e; }
      try { tearDownAnnotations(table); } catch (e) { /* ignore */ void e; }
      try { tearDownOutliers(table); } catch (e) { /* ignore */ void e; }
      try { removeFreezePanes(table); } catch (e) { /* ignore */ void e; }
      try { removeSummaryRow(table); } catch (e) { /* ignore */ void e; }
      try { removeFindUi(table); } catch (e) { /* ignore */ void e; }
      try { teardownVisibleRows(table); } catch (e) { /* ignore */ void e; }
      removePlusIcons(table);
      // Remove any virtual-column lozenges that were appended.
      table.querySelectorAll('.gs-vc-lozenge').forEach((el) => el.remove());
      table.classList.remove('grid-sight-enabled');
      table.removeAttribute('data-grid-sight-processed');
      clearColumnTypes(table);
      // Strip the per-cell index marker that processTableData added.
      // Required for SC-005 (byte-identical DOM after disable()).
      table.querySelectorAll('[data-gs-cell-index]').forEach((cell) =>
        cell.removeAttribute('data-gs-cell-index')
      );
      // Drop empty class attributes that other enrichments may leave behind.
      table.querySelectorAll('[class=""]').forEach((el) => el.removeAttribute('class'));
      if (table.getAttribute('class') === '') table.removeAttribute('class');
    }
    tableRegistry.clear();
    // Remove page-level annotation chrome (menu entry, any open popover/popup).
    if (typeof document !== 'undefined') {
      document
        .querySelectorAll('.gs-annotations-menu-entry, .gs-annotation-popover, .gs-annotation-popup')
        .forEach((el) => el.remove());
    }
    return this;
  },

  /** Re-attach Grid-Sight to the page (alias for init). */
  enable() {
    return this.init();
  },
  
  /**
   * Process a single table element
   * @param table The table element to process
   * @param options Processing options
   */
  processTable(table: HTMLTableElement, options: TableProcessorOptions = {}) {
    if (!table) {
      throw new Error('No table element provided');
    }

    // Ensure the table has an ID
    if (!table.id) {
      table.id = options.id || `grid-sight-${Math.random().toString(36).substr(2, 9)}`;
    }

    // ── Apply persisted view-state BEFORE the lozenge cluster mounts so the
    //    first paint already reflects the restored projection (SC-003).
    try {
      const restored = readViewStateFromHash().find((d) => d.tableId === table.id);
      if (restored) {
        hydrateTable(table, restored, predicateFromDirective);
      }
    } catch (e) { void e; /* lenient on malformed fragments */ }

    // Process the table
    const processedTable = processTable(table, options);

    // Add to registry
    tableRegistry.set(table.id, table);

    try {
      // Inject toggle which will handle the enrichment menu
      injectToggle(table);
      // Per-table start-state (spec 015 R-5/R-6): if this table's resolved
      // config asks for it, reveal its enrichments on load via the SAME path a
      // manual GS click uses. On a global disable→enable cycle init() re-runs
      // processTable for every table, so each returns to its authored
      // start-state (R-6). Default is inactive, so unconfigured tables are
      // unchanged (INV-3).
      const tableCfg = resolveTableConfig(table);
      // Auto-activating an enrichment implies the toggle is revealed.
      if (tableCfg.startActive || tableCfg.activate.size > 0) {
        activateToggle(table);
      }
      if (tableCfg.activate.size > 0) {
        for (const id of tableCfg.activate) autoApplyEnrichment(table, id);
        // Reflect the applied toggles (H / S highlights) in the lozenge cluster.
        refreshLozengeStates(table);
      }
    } catch (error) {
      console.warn('Failed to inject UI elements:', error);
    }

    // Mount filter chip + URL save subscription.
    try { mountFilterChip(table); } catch (e) { void e; }
    try {
      onVisibleRowsChange(table, () => {
        const directives = Array.from(tableRegistry.values())
          .map((t) => serialiseTable(t))
          .filter((d): d is NonNullable<typeof d> => d !== null);
        commitViewStateToLocation(directives);
      });
    } catch (e) { void e; }

    // Cell annotations — gated internally on the `annotations` enrichment
    // being in the effective enabled set (spec 006).
    try { applyAnnotations(table); } catch (e) { void e; }

    // Outlier markers — restore any persisted `gs.o` directives before the
    // table content settles (spec 004, SC-003). Gated on the enrichment being
    // in the effective enabled set for THIS table (spec 015 per-table aware).
    try { if (isEnrichmentEnabled('outlier', table)) applyOutliers(table); } catch (e) { void e; }

    // Freeze panes (spec 014) — auto-rendered; gated on the enabled set so it
    // stays dark when Grid-Sight is globally off (FR-015), per-table aware.
    if (isEnrichmentEnabled('freeze-panes', table)) {
      try { applyFreezePanes(table); } catch (e) { void e; }
    }

    // Summary row (spec 014) — auto-rendered aggregate footer, same gating.
    if (isEnrichmentEnabled('summary-row', table)) {
      try { applySummaryRow(table); } catch (e) { void e; }
    }

    return processedTable;
  },
  
  /**
   * Check if a table is valid for processing
   * A valid table must have at least two rows (header + data)
   * @param table The table element to check
   */
  isValidTable(table: HTMLTableElement | null): boolean {
    // Check if table exists and is an HTMLTableElement
    if (!table || !(table instanceof HTMLTableElement)) {
      return false;
    }
    
    // Check if table has at least two rows (one for header, one for data)
    const rowCount = table.rows.length;
    return rowCount >= 2;
  },
  
  /**
   * Get a table by its ID
   * @param id The ID of the table to retrieve
   */
  getTableById(id: string): HTMLTableElement | undefined {
    return tableRegistry.get(id);
  },
  
  /**
   * Get all processed tables
   */
  getAllTables(): HTMLTableElement[] {
    return Array.from(tableRegistry.values());
  },
  
  /**
   * Apply heatmap to a table row or column
   * @param table The table element
   * @param index The row or column index
   * @param type 'row' or 'column'
   * @param options Heatmap options
   */
  applyHeatmap(
    table: HTMLTableElement | string, 
    index: number, 
    type: 'row' | 'column' = 'column',
    options: HeatmapOptions = {}
  ): void {
    const targetTable = typeof table === 'string' ? this.getTableById(table) : table;
    if (!targetTable) {
      throw new Error('Table not found');
    }
    applyHeatmap(targetTable, index, type, options);
  },
  
  /**
   * Remove heatmap from a table row or column
   * @param table The table element or table ID
   * @param index The row or column index (optional, removes all if not specified)
   * @param type 'row' or 'column' (optional, removes all types if not specified)
   */
  removeHeatmap(
    table: HTMLTableElement | string, 
    index?: number, 
    type?: 'row' | 'column'
  ): void {
    if (typeof table === 'string') {
      const targetTable = this.getTableById(table);
      if (targetTable) {
        removeHeatmap(targetTable, index, type);
      }
    } else {
      removeHeatmap(table, index, type);
    }
  },
  
  /**
   * Toggle heatmap on a table row or column
   * @param table The table element or table ID
   * @param index The row or column index
   * @param type 'row' or 'column'
   * @param options Heatmap options
   */
  toggleHeatmap(
    table: HTMLTableElement | string, 
    index: number, 
    type: 'row' | 'column' = 'column',
    options: HeatmapOptions = {}
  ): void {
    const targetTable = typeof table === 'string' ? this.getTableById(table) : table;
    if (!targetTable) {
      throw new Error('Table not found');
    }
    toggleHeatmap(targetTable, index, type, options);
  },
  
  /**
   * Check if a heatmap is active on a table row or column
   * @param table The table element or table ID
   * @param index The row or column index
   * @param type 'row' or 'column'
   */
  isHeatmapActive(
    table: HTMLTableElement | string, 
    index: number, 
    type: 'row' | 'column' = 'column'
  ): boolean {
    const targetTable = typeof table === 'string' ? this.getTableById(table) : table;
    if (!targetTable) {
      return false;
    }
    return isHeatmapActive(targetTable, index, type);
  },
  
  /**
   * Get the type of data in a column
   * @param table The table element or table ID
   * @param columnIndex The column index
   */
  getColumnType(
    table: HTMLTableElement | string, 
    columnIndex: number
  ): string {
    const targetTable = typeof table === 'string' ? this.getTableById(table) : table;
    if (!targetTable) {
      throw new Error('Table not found');
    }
    
    // Extract table data first
    const tableData = extractTableData(targetTable);
    
    // Then detect column types
    const types = detectColumnTypes(tableData);
    return types[columnIndex] || 'unknown';
  },
  
  /**
   * Get information about the table structure
   * @param table The table element or table ID
   */
  getTableStructure(
    table: HTMLTableElement | string
  ): { rows: number; cols: number; hasHeader: boolean } {
    const targetTable = typeof table === 'string' ? this.getTableById(table) : table;
    if (!targetTable) {
      throw new Error('Table not found');
    }
    
    // Extract table data and analyze its structure
    const tableData = extractTableData(targetTable);
    return {
      rows: tableData.length,
      cols: tableData[0]?.length || 0,
      hasHeader: this.detectIfTableHasHeader(targetTable)
    };
  },
  
  // ===== Dynamic sliders (spec 001) =====

  addSlider(table: HTMLTableElement | string, axis: SliderAxis): GridSightSlider {
    const t = typeof table === 'string' ? this.getTableById(table) : table;
    if (!t) throw new Error('Table not found');
    return sliderAddSlider(t, axis);
  },

  addThresholdSlider(table: HTMLTableElement | string): GridSightSlider {
    const t = typeof table === 'string' ? this.getTableById(table) : table;
    if (!t) throw new Error('Table not found');
    return sliderAddThresholdSlider(t);
  },

  getSliders(table?: HTMLTableElement | string): GridSightSlider[] {
    if (!table) return sliderGetSliders();
    const t = typeof table === 'string' ? this.getTableById(table) : table;
    return t ? sliderGetSliders(t) : [];
  },

  removeAllSliders(table?: HTMLTableElement | string): void {
    if (!table) return sliderRemoveAllSliders();
    const t = typeof table === 'string' ? this.getTableById(table) : table;
    if (t) sliderRemoveAllSliders(t);
  },

  registerFormula(
    table: HTMLTableElement | string,
    fn: (rowValue: number, colValue: number) => number,
    options?: { expression?: string }
  ): void {
    const t = typeof table === 'string' ? this.getTableById(table) : table;
    if (!t) throw new Error('Table not found');
    sliderRegisterFormula(t, fn, options);
  },

  clearFormula(table: HTMLTableElement | string): void {
    const t = typeof table === 'string' ? this.getTableById(table) : table;
    if (!t) return;
    sliderClearFormula(t);
  },

  // ===== Virtual columns (spec 012-virtual-columns) =====
  virtualColumns: {
    addCumulative(table: HTMLTableElement, colKey: string, mode: 'sum' | 'percent' = 'sum'): string | null {
      const id = `cum-${colKey}`;
      const directive: CumulativeDirective = {
        id,
        kind: 'cumulative',
        tableEl: table,
        sourceColKey: colKey,
        mode,
        activationIndex: 0,
      };
      const r = vcActivate(directive);
      return r ? id : null;
    },
    addSparkline(table: HTMLTableElement, scale: 'per-row' | 'shared' = 'per-row'): string | null {
      const directive: SparklineDirective = {
        id: 'spark',
        kind: 'sparkline',
        tableEl: table,
        scale,
        style: 'bar',
      };
      const r = vcActivate(directive);
      return r ? 'spark' : null;
    },
    addCompare(
      table: HTMLTableElement,
      colKeyA: string,
      colKeyB: string,
      mode: 'abs' | 'rel' | 'percent' = 'abs',
    ): string | null {
      const id = `cmp-${colKeyA}-${colKeyB}`;
      const directive: CompareDirective = {
        id,
        kind: 'compare',
        tableEl: table,
        colKeyA,
        colKeyB,
        mode,
      };
      const r = vcActivate(directive);
      return r ? id : null;
    },
    remove(_table: HTMLTableElement, directiveId: string): void {
      vcRemove(directiveId);
    },
    removeAll(table: HTMLTableElement): void {
      vcRemoveAllOnTable(table);
    },
    list(table: HTMLTableElement): ReadonlyArray<{ id: string; kind: VirtualColumnKind; mode?: string }> {
      return vcListDirectives(table);
    },
  },

  // ===== Capability filtering (spec 012-capability-filtering) =====

  /** Read-only list of every registered enrichment id, in display order. */
  enrichmentIds: ENRICHMENT_IDS,

  /** Whether the given enrichment id is in the current effective enabled set. */
  isEnrichmentEnabled(id: string): boolean {
    return isEnrichmentEnabled(id);
  },

  /**
   * Detects if a table has a header row by analyzing its structure
   * @param table The table element to check
   * @returns True if the table appears to have a header row
   */
  detectIfTableHasHeader(table: HTMLTableElement): boolean {
    // Simple heuristic: check if the first row contains mostly text content
    // and the second row contains more varied content
    if (table.rows.length < 2) return false;
    
    const firstRow = table.rows[0];
    const secondRow = table.rows[1];
    
    // Count non-empty cells in first row
    const firstRowNonEmpty = Array.from(firstRow.cells).filter(
      cell => cell.textContent && cell.textContent.trim() !== ''
    ).length;
    
    // If first row is empty, it's probably not a header
    if (firstRowNonEmpty === 0) return false;
    
    // If first row has significantly fewer non-empty cells than second row,
    // it's probably not a header
    const secondRowNonEmpty = Array.from(secondRow.cells).filter(
      cell => cell.textContent && cell.textContent.trim() !== ''
    ).length;
    
    return firstRowNonEmpty >= secondRowNonEmpty;
  }
};

// Auto-initialize when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    GridSight.init();
  });
} else {
  // DOMContentLoaded has already fired, run immediately
  setTimeout(() => GridSight.init(), 0);
}

// Export the GridSight API
export default GridSight;

// Expose to window for direct script include.
// Preserve any pre-bundle `window.gridSight.pageConfig` the host page set so
// the spec-012 capability filter sees it at init time. Without this merge,
// the assignment below would clobber the author's pageConfig declaration.
if (typeof window !== 'undefined') {
  const existing = (window as Window & { gridSight?: { pageConfig?: unknown } }).gridSight;
  const merged = Object.assign(GridSight, existing ? { pageConfig: existing.pageConfig } : {});
  (window as any).gridSight = merged;
}

// Also assign to globalThis for better compatibility
if (typeof globalThis !== 'undefined') {
  (globalThis as any).gridSight = (window as any).gridSight ?? GridSight;
}

// For CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GridSight;
}
