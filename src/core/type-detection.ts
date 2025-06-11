/**
 * Type definitions for column type detection
 */
export type ColumnType = 'numeric' | 'categorical' | 'unknown';

interface TypeDetectionOptions {
  minUniqueValuesForCategorical?: number;
  numericThreshold?: number;
}

const DEFAULT_OPTIONS: Required<TypeDetectionOptions> = {
  minUniqueValuesForCategorical: 3,
  numericThreshold: 0.8, // 80% of cells must be numeric to consider column numeric
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
 * - The first cell is treated as a header
 * - All other cells must contain numbers (with optional units)
 */
export function isNumericColumn(
  cells: HTMLTableCellElement[],
  options: TypeDetectionOptions = {}
): boolean {
  if (cells.length <= 1) return false; // Need at least one data point

  const { numericThreshold } = { ...DEFAULT_OPTIONS, ...options };
  const [header, ...dataCells] = cells;
  
  // Skip empty cells
  const nonEmptyCells = dataCells.filter(cell => cell.textContent?.trim());
  if (nonEmptyCells.length === 0) return false;

  // Count numeric cells
  const numericCount = nonEmptyCells.filter(cell => 
    isNumericValue(cell.textContent || '')
  ).length;

  // Check if enough cells are numeric
  return numericCount / nonEmptyCells.length >= numericThreshold;
}

/**
 * Determines if a column is categorical based on the requirements:
 * - All cells contain text
 * - There are 3 or more unique values
 */
export function isCategoricalColumn(
  cells: HTMLTableCellElement[],
  options: TypeDetectionOptions = {}
): boolean {
  if (cells.length <= 1) return false; // Need at least one data point

  const { minUniqueValuesForCategorical } = { ...DEFAULT_OPTIONS, ...options };
  const [header, ...dataCells] = cells;
  
  // Skip empty cells
  const nonEmptyCells = dataCells
    .map(cell => cell.textContent?.trim())
    .filter((value): value is string => !!value);
  
  if (nonEmptyCells.length === 0) return false;

  // Count unique values (case insensitive)
  const uniqueValues = new Set(
    nonEmptyCells.map(value => value.toLowerCase())
  );

  return uniqueValues.size >= minUniqueValuesForCategorical;
}

/**
 * Detects the type of each column in a table
 */
export function detectColumnTypes(
  table: HTMLTableElement,
  options: TypeDetectionOptions = {}
): ColumnType[] {
  if (!table.rows || table.rows.length === 0) return [];

  const columnCount = table.rows[0].cells.length;
  const columnTypes: ColumnType[] = [];

  for (let i = 0; i < columnCount; i++) {
    const columnCells = Array.from(table.rows).map(row => row.cells[i]);
    
    if (isNumericColumn(columnCells, options)) {
      columnTypes.push('numeric');
    } else if (isCategoricalColumn(columnCells, options)) {
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
  table: HTMLTableElement,
  options: TypeDetectionOptions = {}
): { columnTypes: ColumnType[]; isSuitable: boolean } {
  const columnTypes = detectColumnTypes(table, options);
  
  // Table is suitable if it has at least 2 columns with numeric or categorical data
  const suitableColumnCount = columnTypes.filter(
    type => type === 'numeric' || type === 'categorical'
  ).length;
  
  return {
    columnTypes,
    isSuitable: suitableColumnCount >= 2,
  };
}
