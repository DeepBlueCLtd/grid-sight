import './style.css';
import { findSuitableTables } from './core/table-detection';
import { injectToggle } from './ui/toggle-injector';

// Debug flag - set to false in production
const DEBUG = false;

/**
 * Logs debug information if debug mode is enabled.
 * @param message - The message to log.
 * @param data - Optional data to log.
 */
function debugLog(message: string, data?: unknown): void {
  if (DEBUG) {
    console.log(`[GridSight] ${message}`, data || '');
  }
}

/**
 * Initializes the Grid-Sight functionality on the page.
 * It finds all tables, checks their suitability, and injects the
 * Grid-Sight toggle into the ones that are suitable.
 */
function initializeGridSight(): void {
  debugLog('Initializing Grid-Sight...');
  
  const { suitableTables, totalTables } = findSuitableTables().reduce(
    (result, { table, isSuitable, reason, columnTypes }) => {
      debugLog(`Table analysis: ${isSuitable ? 'Suitable' : 'Not suitable'} - ${reason}`, {
        columnTypes,
        table: table.id ? `#${table.id}` : 'anonymous table'
      });

      if (isSuitable) {
        injectToggle(table);
        result.suitableTables++;
      }
      
      result.totalTables++;
      return result;
    },
    { suitableTables: 0, totalTables: 0 }
  );

  debugLog(`Initialization complete. Found ${suitableTables} suitable tables out of ${totalTables} total tables.`);
}

// Run the initialization logic once the DOM is fully loaded.
window.addEventListener('DOMContentLoaded', initializeGridSight);

// Export for potential use in other modules or for testing.
export { 
  initializeGridSight,
  debugLog // Export for testing
};
