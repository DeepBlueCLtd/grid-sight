/**
 * Grid-Sight - Table Enrichment Library
 * 
 * This library automatically scans for and enriches HTML tables on page load.
 * It provides a simple API for table processing and enrichment.
 */

// Import core modules
import { processTable } from './core/table-processor'
import type { TableProcessorOptions } from './core/table-processor'
import { detectColumnTypes, extractTableData } from './core/type-detection'

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
} from './enrichments/heatmap'

// Import UI components
import { injectToggle } from './ui/toggle-injector'

// Re-export types for external use
export type { 
  TableProcessorOptions, 
  HeatmapOptions 
}

/**
 * The main GridSight API object that will be exposed to the window
 */
// Table state management
const tableRegistry = new Map<string, HTMLTableElement>()

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
  init(options: TableProcessorOptions = {}) {
    // Find all tables that have at least two rows
    document.querySelectorAll<HTMLTableElement>('table').forEach((table, index) => {
      // Skip tables that don't meet our validity criteria
      if (!this.isValidTable(table)) {
        console.warn(`Skipping invalid table at index ${index}: Table must have at least two rows`)
        return
      }
      try {
        this.processTable(table, { 
          id: `table-${index}`,
          ...options 
        })
      } catch (error) {
        console.error(`Failed to process table ${index}:`, error)
      }
    })
    return this
  },
  
  /**
   * Process a single table element
   * @param table The table element to process
   * @param options Processing options
   */
  processTable(table: HTMLTableElement, options: TableProcessorOptions = {}) {
    if (!table) {
      throw new Error('No table element provided')
    }
    
    // Ensure the table has an ID
    if (!table.id) {
      table.id = options.id || `grid-sight-${Math.random().toString(36).substr(2, 9)}`
    }
    
    // Process the table
    const processedTable = processTable(table, options)
    
    // Add to registry
    tableRegistry.set(table.id, table)
    
    try {
      // Inject toggle which will handle the enrichment menu
      injectToggle(table)
    } catch (error) {
      console.warn('Failed to inject UI elements:', error)
    }
    
    return processedTable
  },
  
  /**
   * Check if a table is valid for processing
   * A valid table must have at least two rows (header + data)
   * @param table The table element to check
   */
  isValidTable(table: HTMLTableElement | null): boolean {
    // Check if table exists and is an HTMLTableElement
    if (!table || !(table instanceof HTMLTableElement)) {
      return false
    }
    
    // Check if table has at least two rows (one for header, one for data)
    const rowCount = table.rows.length
    return rowCount >= 2
  },
  
  /**
   * Get a table by its ID
   * @param id The ID of the table to retrieve
   */
  getTableById(id: string): HTMLTableElement | undefined {
    return tableRegistry.get(id)
  },
  
  /**
   * Get all processed tables
   */
  getAllTables(): HTMLTableElement[] {
    return Array.from(tableRegistry.values())
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
    const targetTable = typeof table === 'string' ? this.getTableById(table) : table
    if (!targetTable) {
      throw new Error('Table not found')
    }
    applyHeatmap(targetTable, index, type, options)
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
      const targetTable = this.getTableById(table)
      if (targetTable) {
        removeHeatmap(targetTable, index, type)
      }
    } else {
      removeHeatmap(table, index, type)
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
    const targetTable = typeof table === 'string' ? this.getTableById(table) : table
    if (!targetTable) {
      throw new Error('Table not found')
    }
    toggleHeatmap(targetTable, index, type, options)
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
    const targetTable = typeof table === 'string' ? this.getTableById(table) : table
    if (!targetTable) {
      return false
    }
    return isHeatmapActive(targetTable, index, type)
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
    const targetTable = typeof table === 'string' ? this.getTableById(table) : table
    if (!targetTable) {
      throw new Error('Table not found')
    }
    
    // Extract table data first
    const tableData = extractTableData(targetTable)
    
    // Then detect column types
    const types = detectColumnTypes(tableData)
    return types[columnIndex] || 'unknown'
  },
  
  /**
   * Get information about the table structure
   * @param table The table element or table ID
   */
  getTableStructure(
    table: HTMLTableElement | string
  ): { rows: number; cols: number; hasHeader: boolean } {
    const targetTable = typeof table === 'string' ? this.getTableById(table) : table
    if (!targetTable) {
      throw new Error('Table not found')
    }
    
    // Extract table data and analyze its structure
    const tableData = extractTableData(targetTable)
    return {
      rows: tableData.length,
      cols: tableData[0]?.length || 0,
      hasHeader: this.detectIfTableHasHeader(targetTable)
    }
  },
  
  /**
   * Detects if a table has a header row by analyzing its structure
   * @param table The table element to check
   * @returns True if the table appears to have a header row
   */
  detectIfTableHasHeader(table: HTMLTableElement): boolean {
    // Simple heuristic: check if the first row contains mostly text content
    // and the second row contains more varied content
    if (table.rows.length < 2) return false
    
    const firstRow = table.rows[0]
    const secondRow = table.rows[1]
    
    // Count non-empty cells in first row
    const firstRowNonEmpty = Array.from(firstRow.cells).filter(
      (cell) => cell.textContent && cell.textContent.trim() !== ''
    ).length
    
    // If first row is empty, it's probably not a header
    if (firstRowNonEmpty === 0) return false
    
    // If first row has significantly fewer non-empty cells than second row,
    // it's probably not a header
    const secondRowNonEmpty = Array.from(secondRow.cells).filter(
      (cell) => cell.textContent && cell.textContent.trim() !== ''
    ).length
    
    return firstRowNonEmpty >= secondRowNonEmpty
  }
}

// Auto-initialize when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    GridSight.init()
  })
} else {
  // DOMContentLoaded has already fired, run immediately
  setTimeout(() => GridSight.init(), 0)
}

// Export the GridSight API
export default GridSight

// Expose to window for direct script include
// Use a more direct approach to ensure it's available globally
if (typeof window !== 'undefined') {
  (window as any).gridSight = GridSight
}

// Also assign to globalThis for better compatibility
if (typeof globalThis !== 'undefined') {
  (globalThis as any).gridSight = GridSight
}

// For CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GridSight
}
