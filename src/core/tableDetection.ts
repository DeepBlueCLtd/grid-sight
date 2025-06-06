/**
 * Table detection module
 * Responsible for finding valid HTML tables on the page
 */

import { createTableToggle } from '../ui/tableToggle'

/**
 * Checks if a table has the required structure (thead and tbody)
 * @param table - The HTML table element to check
 * @returns boolean indicating if the table has valid structure
 */
export const isValidTable = (table: HTMLTableElement): boolean => {
  const hasThead = !!table.querySelector('thead')
  const hasTbody = !!table.querySelector('tbody')
  
  if (!hasThead || !hasTbody) {
    console.error('Grid-Sight: invalid table structure - missing thead or tbody')
    return false
  }
  
  return true
}

/**
 * Process a single table element
 * @param table - The HTML table element to process
 */
export const processTable = (table: HTMLTableElement): void => {
  if (!isValidTable(table)) return
  
  // Create and inject the Grid-Sight toggle
  createTableToggle(table)
}

/**
 * Initialize the table detection functionality
 * Finds all tables on the page and processes them
 */
export const initTableDetection = (): void => {
  // Find all tables on the page
  const tables = document.querySelectorAll('table')
  
  // Process each table
  tables.forEach(table => {
    processTable(table as HTMLTableElement)
  })
  
  // Set up mutation observer to detect dynamically added tables
  setupTableObserver()
}

/**
 * Sets up a MutationObserver to detect tables added dynamically to the DOM
 */
const setupTableObserver = (): void => {
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        // Check if the added node is a table
        if (node.nodeName === 'TABLE') {
          processTable(node as HTMLTableElement)
        }
        
        // Check for tables within added nodes
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tables = (node as Element).querySelectorAll('table')
          tables.forEach(table => {
            processTable(table as HTMLTableElement)
          })
        }
      })
    })
  })
  
  // Start observing the document body for DOM changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
}