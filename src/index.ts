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
import { injectToggle } from './ui/toggle-injector';
import { removePlusIcons } from './ui/header-utils';

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
import { ensureHeatmapMarkerListener } from './ui/heatmap-marker';

// Spec 012 — capability filtering
import { ENRICHMENT_IDS } from './core/enrichment-registry';
import { parsePageConfig } from './core/page-config';
import {
  setPageConfig,
  setVisitorOverride,
  isEnrichmentEnabled,
} from './core/enabled-set-state';
import { resolveVisitorEnrichments } from './utils/slider-persistence';
import { clearColumnTypes } from './core/column-types-cache';
import { mountTogglePanel } from './ui/toggle-panel';

export interface InitOptions extends TableProcessorOptions {
  enrichments?: readonly string[];
  showToggleUi?: boolean;
}

// Activate the heatmap-marker listener once at module load. It is a no-op if no
// dual-axis sliders are ever added.
ensureHeatmapMarkerListener();

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
    // Spec 012: read page-level enrichment config (window.gridSight.pageConfig)
    // and merge any per-field overrides from `options`. Per-field precedence —
    // `options` wins, then `pageConfig`, then library defaults.
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
    };
    setPageConfig(merged);

    // Visitor override (URL > localStorage). Resets to undefined when neither
    // is present so the resolver falls back to the page config.
    setVisitorOverride(resolveVisitorEnrichments());

    // Find all tables that have at least two rows.
    // Honour `data-gs-ignore`: tables marked with this attribute are left
    // untouched (no GS toggle, no lozenges) — useful for "before" reference
    // tables on demo pages.
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
      } catch (error) {
        console.error(`Failed to process table ${index}:`, error);
      }
    });

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
    for (const table of Array.from(tableRegistry.values())) {
      try { removeHeatmap(table); } catch (e) { /* ignore */ void e; }
      const toggle = table.querySelector('.grid-sight-toggle-container');
      if (toggle) toggle.remove();
      removePlusIcons(table);
      table.classList.remove('grid-sight-enabled');
      table.removeAttribute('data-grid-sight-processed');
      clearColumnTypes(table);
    }
    tableRegistry.clear();
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
    
    // Process the table
    const processedTable = processTable(table, options);
    
    // Add to registry
    tableRegistry.set(table.id, table);
    
    try {
      // Inject toggle which will handle the enrichment menu
      injectToggle(table);
    } catch (error) {
      console.warn('Failed to inject UI elements:', error);
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
    fn: (rowValue: number, colValue: number) => number
  ): void {
    const t = typeof table === 'string' ? this.getTableById(table) : table;
    if (!t) throw new Error('Table not found');
    sliderRegisterFormula(t, fn);
  },

  clearFormula(table: HTMLTableElement | string): void {
    const t = typeof table === 'string' ? this.getTableById(table) : table;
    if (!t) return;
    sliderClearFormula(t);
  },

  // ===== Capability filtering (spec 012) =====

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
