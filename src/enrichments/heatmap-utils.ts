/**
 * Normalizes a value to a 0-1 range based on min and max
 */
export function normalizeValue(
  value: number,
  min: number,
  max: number
): number {
  if (min === max) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Gets a color from a color scale based on a normalized value
 */
export function getColorForValue(
  value: number,
  min: number,
  max: number,
  colorScale: string[]
): string {
  if (colorScale.length === 0) return '';
  if (colorScale.length === 1) return colorScale[0];
  
  const normalized = normalizeValue(value, min, max);
  const index = Math.min(
    colorScale.length - 1,
    Math.floor(normalized * colorScale.length)
  );
  
  return colorScale[Math.max(0, index)];
}

/**
 * Calculates min and max values while ignoring non-numeric values
 */
export function calculateMinMax(
  values: (number | string)[],
  existingMin?: number,
  existingMax?: number
): { min: number; max: number } {
  let min = existingMin ?? Number.POSITIVE_INFINITY;
  let max = existingMax ?? Number.NEGATIVE_INFINITY;
  let hasNumericValues = false;

  for (const value of values) {
    const num = typeof value === 'number' ? value : parseFloat(value as string);
    if (!isNaN(num)) {
      hasNumericValues = true;
      min = Math.min(min, num);
      max = Math.max(max, num);
    }
  }

  if (!hasNumericValues) {
    return { min: 0, max: 0 };
  }

  return { min, max };
}

/**
 * Extracts numeric values from table cells
 */
export function extractNumericValues(
  cells: HTMLTableCellElement[],
  options: { skipHeader?: boolean } = {}
): number[] {
  const values: number[] = [];
  const cellArray = Array.isArray(cells) ? cells : Array.from(cells);
  
  // If skipHeader is true, we need to determine how many cells are in the first row
  // to skip all of them
  if (options.skipHeader && cellArray.length > 0) {
    // Find the first row by traversing up to the row element
    const firstCell = cellArray[0] as HTMLTableCellElement;
    const firstRow = firstCell.closest('tr');
    
    if (firstRow) {
      // Skip all cells that are in the first row
      const headerCells = Array.from(firstRow.cells);
      const filteredCells = cellArray.filter(
        (cell): cell is HTMLTableCellElement => 
          !headerCells.includes(cell as HTMLTableCellElement)
      );
      
      // Process remaining cells
      for (const cell of filteredCells) {
        const text = cell.textContent?.trim() || '';
        const num = parseFloat(text);
        if (!isNaN(num)) {
          values.push(num);
        }
      }
      
      return values;
    }
  }
  
  // Default processing when not skipping header or no header found
  for (const cell of cellArray as HTMLTableCellElement[]) {
    const text = cell.textContent?.trim() || '';
    const num = parseFloat(text);
    if (!isNaN(num)) {
      values.push(num);
    }
  }
  
  return values;
}
