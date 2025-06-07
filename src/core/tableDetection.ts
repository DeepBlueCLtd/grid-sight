/**
 * Table detection module
 * Responsible for finding valid HTML tables on the page and classifying their data
 */

import { createTableToggle } from '../ui/tableToggle'
import { registerTable, updateTableConfig } from './state'
import { DataType } from './types'

/**
 * Checks if a table is suitable for Grid-Sight
 * @param table - The HTML table element to check
 * @returns boolean indicating if the table is suitable for Grid-Sight
 */
export const isValidTable = (table: HTMLTableElement): boolean => {
  // Check if the table has at least one row (tr element)
  // This is more lenient than requiring explicit thead and tbody elements
  const hasRows = table.querySelectorAll('tr').length > 0
  
  if (!hasRows) {
    console.error('Grid-Sight: invalid table structure - no rows found')
    return false
  }
  
  // Check if table has opted out via data attribute
  if (table.dataset.gsOptOut === 'true') {
    console.info('Grid-Sight: table has opted out via data-gs-opt-out attribute')
    return false
  }
  
  // Check if table is marked as presentation-only
  if (table.getAttribute('role') === 'presentation') {
    console.info('Grid-Sight: table is marked as presentation-only')
    return false
  }
  
  // Check if table is visible (has offsetParent)
  if (table.offsetParent === null) {
    console.info('Grid-Sight: table is not visible')
    return false
  }
  
  // Check for data presence - at least one numeric or categorical column
  const columnTypes = classifyTableColumns(table)
  const hasDataColumns = columnTypes.some(type => type === 'numeric' || type === 'categorical')
  
  if (!hasDataColumns) {
    console.info('Grid-Sight: table contains no numeric or categorical data')
    return false
  }
  
  return true
}

/**
 * Classifies each column in a table as numeric, categorical, or unknown
 * @param table - The HTML table element to analyze
 * @returns Array of column data types
 */
export const classifyTableColumns = (table: HTMLTableElement): DataType[] => {
  const columnTypes: DataType[] = []
  
  // Get all rows from the table, separating header rows from data rows
  const allRows = Array.from(table.querySelectorAll('tr'))
  if (allRows.length === 0) return columnTypes
  
  // Consider the first row as header if it's in a thead, or just the first row if no thead exists
  const theadRows = Array.from(table.querySelectorAll('thead tr'))
  const headerRows = theadRows.length > 0 ? theadRows : [allRows[0]]
  const dataRows = allRows.filter(row => !headerRows.includes(row))
  
  if (dataRows.length === 0) return columnTypes
  
  // Determine the maximum number of cells in any row
  const maxCells = Math.max(...dataRows.map(row => row.cells.length))
  
  // Process each column, but only consider non-header cells for classification
  for (let colIndex = 0; colIndex < maxCells; colIndex++) {
    const cellValues = dataRows
      .map(row => row.cells[colIndex]?.innerText?.trim() || '')
      .filter(text => text !== '') // Skip empty cells
    
    columnTypes.push(classifyDataValues(cellValues))
  }
  
  return columnTypes
}

/**
 * Classifies each row in a table as numeric, categorical, or unknown
 * @param table - The HTML table element to analyze
 * @returns Array of row data types
 */
export const classifyTableRows = (table: HTMLTableElement): DataType[] => {
  const rowTypes: DataType[] = []
  
  // Get all rows from the table, regardless of whether they're in thead, tbody, or directly in table
  const rows = Array.from(table.querySelectorAll('tr'))
  if (rows.length === 0) return rowTypes
  
  // Process each row
  for (const row of rows) {
    const cellValues = Array.from(row.cells)
      .map(cell => cell.innerText.trim())
      .filter(text => text !== '') // Skip empty cells
    
    rowTypes.push(classifyDataValues(cellValues))
  }
  
  return rowTypes
}

/**
 * Classifies an array of values as numeric, categorical, or unknown
 * @param values - Array of string values to classify
 * @returns The data type classification
 */
export const classifyDataValues = (values: string[]): DataType => {
  if (values.length === 0) return 'unknown'
  
  // Check if values are numeric
  const numericValues = values.map(v => parseFloat(v))
  const validNumericCount = numericValues.filter(n => !isNaN(n)).length
  const uniqueNumericValues = new Set(numericValues.filter(n => !isNaN(n))).size
  
  // Consider numeric if all values can be parsed as numbers and there's variation
  if (validNumericCount === values.length && uniqueNumericValues > 1) {
    return 'numeric'
  }
  
  // Check if values are categorical
  const uniqueValues = new Set(values)
  if (uniqueValues.size <= 20 && uniqueValues.size < values.length * 0.8) {
    return 'categorical'
  }
  
  return 'unknown'
}

/**
 * Process a single table element
 * @param table - The HTML table element to process
 */
export const processTable = (table: HTMLTableElement): void => {
  if (!isValidTable(table)) return
  
  // Register the table with state management
  registerTable(table)
  
  // Analyze and store column and row types
  const columnTypes = classifyTableColumns(table)
  const rowTypes = classifyTableRows(table)
  
  // Update the table configuration with column and row type information
  updateTableConfig(table, {
    columnTypes,
    rowTypes
  })
  
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