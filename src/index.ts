/**
 * Grid-Sight - Table Enrichment Library
 * 
 * This library automatically scans for and enriches HTML tables on page load.
 * It provides a simple API for table processing and enrichment.
 */

// Import necessary modules
import { processTable } from './core/table-processor';

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
  init() {
    // Find all tables with both thead and tbody
    document.querySelectorAll<HTMLTableElement>('table:has(thead):has(tbody)').forEach((table, index) => {
      try {
        this.processTable(table, { id: `table-${index}` });
      } catch (error) {
        console.error(`Failed to process table ${index}:`, error);
      }
    });
    return this;
  },
  
  /**
   * Process a single table element
   * @param table The table element to process
   * @param options Processing options
   */
  processTable(table: HTMLTableElement, options: { id?: string } = {}) {
    if (!table) {
      throw new Error('No table element provided');
    }
    
    // Ensure the table has an ID
    if (!table.id) {
      table.id = options.id || `grid-sight-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    return processTable(table, options);
  },
  
  /**
   * Check if a table is valid for processing
   * @param table The table element to check
   */
  isValidTable(table: HTMLTableElement | null): boolean {
    return table !== null && 
           table instanceof HTMLTableElement && 
           table.tHead !== null && 
           table.tBodies.length > 0;
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

// Expose to window for direct script include
// Use a more direct approach to ensure it's available globally
if (typeof window !== 'undefined') {
  (window as any).gridSight = GridSight;
}

// Also assign to globalThis for better compatibility
if (typeof globalThis !== 'undefined') {
  (globalThis as any).gridSight = GridSight;
}

// For CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GridSight;
}
