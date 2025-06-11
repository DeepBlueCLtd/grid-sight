/**
 * Type definitions for column type detection
 */
export type ColumnType = 'numeric' | 'categorical' | 'unknown';

export interface TypeDetectionOptions {
  minUniqueValuesForCategorical?: number;
  numericThreshold?: number;
  hasHeader?: boolean;
}

const DEFAULT_OPTIONS: Required<TypeDetectionOptions> = {
  minUniqueValuesForCategorical: 3,
  numericThreshold: 0.8, // 80% of cells must be numeric to consider column numeric
  hasHeader: true,
};

/**
 * Cleans a string value to extract a numeric value, handling various number formats and currency symbols
 * @param value The string value to clean
 * @returns The cleaned number as a float, or null if the value cannot be converted to a number
 */
export function cleanNumericCell(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  
  // If it's already a number, return it directly
  if (typeof value === 'number') return isFinite(value) ? value : null;
  
  // Handle empty strings
  const trimmed = value.trim();
  if (!trimmed) return null;
  
  // Handle currency symbols and other non-numeric prefixes/suffixes
  // Remove any non-numeric characters except digits, decimal points, commas, and minus
  let numericString = trimmed
    // Remove all non-numeric characters except digits, decimal points, commas, and minus
    .replace(/[^\d.,-]/g, '');
  
  // If we're left with an empty string, it wasn't a valid number
  if (!numericString) return null;
  
  // Handle negative numbers (only allow minus at the start)
  const isNegative = numericString.startsWith('-');
  if (isNegative) {
    numericString = numericString.slice(1);
  }
  
  // Remove any remaining minus signs (they're only valid at the start)
  if (numericString.includes('-')) return null;
  
  // Handle decimal separators - only allow one decimal point
  const parts = numericString.split('.');
  if (parts.length > 2) return null; // More than one decimal point
  
  // Handle thousands separators (commas) - they must be in the correct positions
  if (parts[0].includes(',')) {
    // Check that commas are only used as thousand separators
    const integerPart = parts[0];
    const groups = integerPart.split(',');
    
    // First group can be 1-3 digits, subsequent groups must be exactly 3 digits
    if (groups[0].length === 0 || groups[0].length > 3) return null;
    for (let i = 1; i < groups.length; i++) {
      if (groups[i].length !== 3) return null;
    }
    
    // Remove commas for final parsing
    numericString = groups.join('') + (parts[1] ? `.${parts[1]}` : '');
  } else if (parts.length === 2) {
    // No commas, but has a decimal point - ensure decimal part is valid
    if (parts[1].includes(',')) return null; // Comma in decimal part
    numericString = parts[0] + '.' + parts[1];
  }
  
  // Re-add the negative sign if it was present
  if (isNegative) {
    numericString = '-' + numericString;
  }
  
  // Parse the final number
  const num = parseFloat(numericString);
  return isFinite(num) ? num : null;
}

/**
 * Checks if a string can be converted to a number, including with units and various number formats
 * @param value The string to check
 * @returns true if the string can be converted to a number, false otherwise
 */
function isNumericValue(value: string): boolean {
  return cleanNumericCell(value) !== null;
}

/**
 * Determines if a column is numeric based on the requirements:
 * - If hasHeader is true, the first cell is treated as a header
 * - All non-empty cells must be valid numbers (with optional units/currency symbols)
 * - Empty cells are allowed but don't count toward the decision
 */
export function isNumericColumn(
  values: string[],
  options: TypeDetectionOptions = {}
): boolean {
  const { hasHeader } = { ...DEFAULT_OPTIONS, ...options };
  
  // Skip header if present
  const dataValues = hasHeader ? values.slice(1) : [...values];
  
  // Get non-empty values
  const nonEmptyValues = dataValues
    .map(value => value?.trim())
    .filter((value): value is string => !!value);
  
  // If all values are empty, it's not numeric
  if (nonEmptyValues.length === 0) return false;
  
  // All non-empty values must be numeric
  return nonEmptyValues.every(value => isNumericValue(value));
}

/**
 * Determines if a column is categorical based on the requirements:
 * - If hasHeader is true, the first cell is treated as a header
 * - All non-empty cells must be non-numeric text
 * - Must have at least minUniqueValuesForCategorical unique values (case-insensitive)
 * - Empty cells are allowed but don't count toward the decision
 */
export function isCategoricalColumn(
  values: string[],
  options: TypeDetectionOptions = {}
): boolean {
  const { minUniqueValuesForCategorical, hasHeader } = { ...DEFAULT_OPTIONS, ...options };
  
  // Skip header if present
  const dataValues = hasHeader ? values.slice(1) : [...values];
  
  // Get non-empty values
  const nonEmptyValues = dataValues
    .map(value => value?.trim())
    .filter((value): value is string => !!value);
  
  // If all values are empty, it's not categorical
  if (nonEmptyValues.length === 0) return false;
  
  // Check that no values are numeric
  if (nonEmptyValues.some(isNumericValue)) {
    return false;
  }
  
  // Count unique values (case insensitive)
  const uniqueValues = new Set(
    nonEmptyValues.map(value => value.toLowerCase())
  );
  
  // Must have at least the minimum number of unique values
  return uniqueValues.size >= minUniqueValuesForCategorical;
}

/**
 * Detects the type of each column in a 2D array of strings
 * 
 * @param rows - 2D array of strings representing the table data
 * @param options - Type detection options
 * @returns Array of ColumnType values for each column
 */
export function detectColumnTypes(
  rows: string[][],
  options: TypeDetectionOptions = {}
): ColumnType[] {
  if (!rows.length) return [];
  
  const columnCount = rows[0].length;
  const columnTypes: ColumnType[] = [];

  for (let col = 0; col < columnCount; col++) {
    const column = rows.map(row => row[col] || '');
    
    // First check if it's numeric (most restrictive)
    if (isNumericColumn(column, options)) {
      columnTypes.push('numeric');
    } 
    // Then check if it's categorical
    else if (isCategoricalColumn(column, options)) {
      columnTypes.push('categorical');
    } 
    // Default to unknown
    else {
      columnTypes.push('unknown');
    }
  }

  return columnTypes;
}

/**
 * Analyzes a table to determine column types and overall suitability
 */
export function analyzeTable(
  rows: string[][],
  options: TypeDetectionOptions = {}
): { columnTypes: ColumnType[]; isSuitable: boolean } {
  const columnTypes = detectColumnTypes(rows, options);
  
  // Table is suitable if it has at least 2 columns with numeric or categorical data
  const suitableColumnCount = columnTypes.filter(
    type => type === 'numeric' || type === 'categorical'
  ).length;
  
  return {
    columnTypes,
    isSuitable: suitableColumnCount >= 1,
  };
}

/**
 * Extracts text content from an HTML table into a 2D array of strings
 */
export function extractTableData(table: HTMLTableElement): string[][] {
  if (!table.rows) return [];
  
  const rows: string[][] = [];
  
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i];
    const rowData: string[] = [];
    
    for (let j = 0; j < row.cells.length; j++) {
      rowData.push(row.cells[j]?.textContent?.trim() || '');
    }
    
    rows.push(rowData);
  }
  
  return rows;
}
