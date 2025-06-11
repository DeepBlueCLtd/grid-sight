import { analyzeTable, extractTableData } from './type-detection';

/**
 * Finds all table elements in the document.
 * @returns A NodeListOf<HTMLTableElement> containing all tables found.
 */
export function findTables(): NodeListOf<HTMLTableElement> {
  return document.querySelectorAll('table');
}

/**
 * Checks if a table has a valid structure with both thead and tbody elements.
 * @param table The HTMLTableElement to check.
 * @returns True if the table has both thead and tbody, false otherwise.
 */
function hasValidTableStructure(table: HTMLTableElement): boolean {
  return table.tHead !== null && table.tBodies.length > 0;
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
    };
  }

  // Check for minimum row count (header + at least one data row)
  if (table.rows.length < 2) {
    return { 
      isSuitable: false, 
      reason: 'Table must have at least one data row' 
    };
  }

  // Extract table data and analyze column types
  const tableData = extractTableData(table);
  const { isSuitable, columnTypes } = analyzeTable(tableData);
  
  if (!isSuitable) {
    return { 
      isSuitable: false, 
      reason: `Table needs at least two numeric or categorical columns (found: ${columnTypes.filter(t => t !== 'unknown').length})` 
    };
  }

  return { 
    isSuitable: true, 
    reason: 'Table meets all criteria for enrichment' 
  };
}

/**
 * Finds all suitable tables in the document.
 * @returns An array of objects containing suitable tables and their analysis results.
 */
export function findSuitableTables(): Array<{
  table: HTMLTableElement;
  isSuitable: boolean;
  reason: string;
  columnTypes: string[];
}> {
  const tables = findTables();
  return Array.from(tables).map(table => {
    const tableData = extractTableData(table);
    const { isSuitable, columnTypes } = analyzeTable(tableData);
    
    // Get the reason for suitability
    let reason = '';
    if (!table.tHead || table.tBodies.length === 0) {
      reason = 'Table must have both <thead> and <tbody> elements';
    } else if (table.rows.length < 2) {
      reason = 'Table must have at least one data row';
    } else if (!isSuitable) {
      reason = `Table needs at least two numeric or categorical columns (found: ${columnTypes.filter(t => t !== 'unknown').length})`;
    } else {
      reason = 'Table meets all criteria for enrichment';
    }
    
    return { table, isSuitable, reason, columnTypes };
  });
}
