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
 * Checks if a string can be converted to a number, including with units
 */
function isNumericValue(value: string): boolean {
  // Remove common unit suffixes and trim whitespace
  const numericString = value
    .trim()
    .replace(/[£$€¥₩₽₪₺₴₸฿₫₭₱﷼₨₹₲₵₳₿₾₽₿₮₩₫₭₡₢₤₣₯₠₣₤₥₦₧₨₪₫€₭₮₯₰₠₡₢₣₤₥₦₧₨₩₪₫€₭₮₯₰₠₡₢₣₤₥₦₧₨₩₪₫€₭₮₯₰]/g, '') // Currency symbols
    .replace(/[^\d.,-]/g, '') // Keep only digits, decimal points, commas, and negative signs
    .replace(/,/g, '.'); // Replace commas with periods for consistent parsing

  // Check if the remaining string is a valid number
  return !isNaN(parseFloat(numericString)) && isFinite(Number(numericString));
}

/**
 * Determines if a column is numeric based on the requirements:
 * - If hasHeader is true, the first cell is treated as a header
 * - All other cells must contain numbers (with optional units)
 */
export function isNumericColumn(
  values: string[],
  options: TypeDetectionOptions = {}
): boolean {
  const { numericThreshold, hasHeader } = { ...DEFAULT_OPTIONS, ...options };
  
  // Skip header if present
  const dataValues = hasHeader ? values.slice(1) : [...values];
  
  // Skip empty values
  const nonEmptyValues = dataValues.filter(value => value?.trim());
  if (nonEmptyValues.length === 0) return false;

  // Count numeric values
  const numericCount = nonEmptyValues.filter(value => 
    isNumericValue(value)
  ).length;

  // Check if enough values are numeric
  return numericCount / nonEmptyValues.length >= numericThreshold;
}

/**
 * Determines if a column is categorical based on the requirements:
 * - All cells contain text
 * - There are 3 or more unique values (configurable)
 */
export function isCategoricalColumn(
  values: string[],
  options: TypeDetectionOptions = {}
): boolean {
  const { minUniqueValuesForCategorical, hasHeader } = { ...DEFAULT_OPTIONS, ...options };
  
  // Skip header if present
  const dataValues = hasHeader ? values.slice(1) : [...values];
  
  // Skip empty values
  const nonEmptyValues = dataValues
    .map(value => value?.trim())
    .filter((value): value is string => !!value);
  
  if (nonEmptyValues.length === 0) return false;

  // Count unique values (case insensitive)
  const uniqueValues = new Set(
    nonEmptyValues.map(value => value.toLowerCase())
  );

  return uniqueValues.size >= minUniqueValuesForCategorical;
}

/**
 * Detects the type of each column in a 2D array of strings
 */
export function detectColumnTypes(
  rows: string[][],
  options: TypeDetectionOptions = {}
): ColumnType[] {
  if (!rows.length) return [];
  
  const columnCount = rows[0].length;
  const columnTypes: ColumnType[] = [];

  for (let col = 0; col < columnCount; col++) {
    const columnValues = rows.map(row => row[col] || '');
    
    if (isNumericColumn(columnValues, options)) {
      columnTypes.push('numeric');
    } else if (isCategoricalColumn(columnValues, options)) {
      columnTypes.push('categorical');
    } else {
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
    isSuitable: suitableColumnCount >= 2,
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
