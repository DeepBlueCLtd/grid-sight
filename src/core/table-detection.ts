import { analyzeTable as analyzeTableType, extractTableData } from './type-detection'
import type { ColumnType } from './type-detection'

// Re-export analyzeTable from type-detection
export { analyzeTableType as analyzeTable }

/**
 * Finds all table elements in the document.
 * @returns A NodeListOf<HTMLTableElement> containing all tables found.
 */
export function findTables(): NodeListOf<HTMLTableElement> {
  return document.querySelectorAll('table')
}

/**
 * Checks if a table has a valid structure with both thead and tbody elements.
 * @param table The HTMLTableElement to check.
 * @returns True if the table has both thead and tbody, false otherwise.
 */
function hasValidTableStructure(table: HTMLTableElement): boolean {
  return table.tHead !== null && table.tBodies.length > 0
}

/**
 * Checks if a table is suitable for enrichment based on structure and content.
 * A table is considered suitable if:
 * 1. It has a valid structure (both thead and tbody)
 * 2. It has more than one row
 * 3. It has at least two columns that are either numeric or categorical
 * 
 * @param table The HTMLTableElement to check.
 * @returns An object containing:
 *   - isSuitable: boolean indicating if the table is suitable
 *   - reason: string explaining why the table is/isn't suitable
 */
export function isTableSuitable(table: HTMLTableElement): { isSuitable: boolean; reason: string } {
  // Check for minimum structure requirements
  if (!hasValidTableStructure(table)) {
    return { 
      isSuitable: false, 
      reason: 'Table must have both <thead> and <tbody> elements' 
    }
  }

  // Check for minimum row count (header + at least one data row)
  if (table.rows.length < 2) {
    return { 
      isSuitable: false, 
      reason: 'Table must have at least one data row' 
    }
  }

  // Extract table data and analyze column types
  const tableData = extractTableData(table)
  const { columnTypes } = analyzeTableType(tableData)
  
  // Check if we have at least one suitable column (numeric or categorical)
  const suitableColumns = columnTypes.filter((t) => t === 'numeric' || t === 'categorical')
  const hasEnoughSuitableColumns = suitableColumns.length >= 1
  
  // Update the reason based on the analysis
  let reason = ''
  if (!hasEnoughSuitableColumns) {
    reason = 'Table needs at least one numeric or categorical column'
  } else {
    reason = 'Table meets all criteria for enrichment'
  }
  
  return { 
    isSuitable: hasEnoughSuitableColumns, 
    reason 
  }
}

/**
 * Finds all suitable tables in the document.
 * @returns An array of objects containing suitable tables and their analysis results.
 */
export function findSuitableTables(): Array<{
  table: HTMLTableElement;
  isSuitable: boolean;
  reason: string;
  columnTypes: ColumnType[];
}> {
  const tables = findTables()
  return Array.from(tables).map((table) => {
    const tableData = extractTableData(table)
    const { columnTypes, isSuitable } = analyzeTableType(tableData)
    
    // Check if we have at least one suitable column
    const suitableColumns = columnTypes.filter((t: ColumnType) => t === 'numeric' || t === 'categorical')
    const hasEnoughSuitableColumns = suitableColumns.length >= 1
    
    // Get the reason for suitability
    let reason = ''
    if (!table.tHead || table.tBodies.length === 0) {
      reason = 'Table must have both <thead> and <tbody> elements'
    } else if (table.rows.length < 2) {
      reason = 'Table must have at least one data row'
    } else if (!hasEnoughSuitableColumns) {
      reason = 'Table does not have enough suitable columns (need at least 1)'
    } else {
      reason = 'Table meets all criteria for enrichment'
    }
    
    return { table, isSuitable, reason, columnTypes }
  })
}
