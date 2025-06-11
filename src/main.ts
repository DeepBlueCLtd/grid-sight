import './style.css'
import { findTables, isTableSuitable } from './core/table-detection'
import { injectToggle } from './ui/toggle-injector'

/**
 * Initializes the Grid-Sight functionality on the page.
 * It finds all tables, checks their suitability, and injects the
 * Grid-Sight toggle into the ones that are suitable.
 */
function initializeGridSight(): void {
  const tables = findTables()
  tables.forEach(table => {
    if (isTableSuitable(table)) {
      injectToggle(table)
    }
  })
}

// Run the initialization logic once the DOM is fully loaded.
window.addEventListener('DOMContentLoaded', initializeGridSight)

// Export for potential use in other modules or for testing.
export { initializeGridSight }
