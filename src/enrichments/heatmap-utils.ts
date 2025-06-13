/**
 * Normalizes a numeric value to a 0-1 range based on provided minimum and maximum bounds.
 * The result is clamped between 0 and 1, inclusive.
 * 
 * @example
 * // Returns 0.5
 * normalizeValue(5, 0, 10);
 * 
 * @param value - The value to normalize
 * @param min - The minimum value in the range
 * @param max - The maximum value in the range
 * @returns A number between 0 and 1 representing the normalized position of the value
 */
export function normalizeValue(
  value: number,
  min: number,
  max: number
): number {
  if (min === max) return 0
  return Math.max(0, Math.min(1, (value - min) / (max - min)))
}

/**
 * Gets a color from a color scale based on a value's position within a range.
 * The value is first normalized to a 0-1 range, then mapped to the closest color in the scale.
 * 
 * @example
 * // Returns '#ff0000' (red)
 * getColorForValue(5, 0, 10, ['#ff0000', '#00ff00']);
 * 
 * @param value - The value to get a color for
 * @param min - The minimum value in the range
 * @param max - The maximum value in the range
 * @param colorScale - An array of colors in the scale, from minimum to maximum
 * @returns The color from the scale that best represents the value's position
 */
export function getColorForValue(
  value: number,
  min: number,
  max: number,
  colorScale: string[]
): string {
  if (colorScale.length === 0) return ''
  if (colorScale.length === 1) return colorScale[0]
  
  const normalized = normalizeValue(value, min, max)
  const index = Math.min(
    colorScale.length - 1,
    Math.floor(normalized * colorScale.length)
  )
  
  return colorScale[Math.max(0, index)]
}

/**
 * Calculates the minimum and maximum numeric values from an array of values.
 * Non-numeric values and strings that can't be parsed as numbers are ignored.
 * Can optionally update existing min/max values.
 * 
 * @example
 * // Returns { min: 1, max: 3 }
 * calculateMinMax([1, 2, 3, 'a', '4']);
 * 
 * @param values - Array of values to analyze (numbers or strings that can be parsed as numbers)
 * @param [existingMin] - Optional existing minimum value to update
 * @param [existingMax] - Optional existing maximum value to update
 * @returns An object containing the calculated min and max values
 */
export function calculateMinMax(
  values: (number | string)[],
  existingMin?: number,
  existingMax?: number
): { min: number; max: number } {
  let min = existingMin ?? Number.POSITIVE_INFINITY
  let max = existingMax ?? Number.NEGATIVE_INFINITY
  let hasNumericValues = false

  for (const value of values) {
    const num = typeof value === 'number' ? value : parseFloat(value as string)
    if (!isNaN(num)) {
      hasNumericValues = true
      min = Math.min(min, num)
      max = Math.max(max, num)
    }
  }

  if (!hasNumericValues) {
    return { min: 0, max: 0 }
  }

  return { min, max }
}

/**
 * Extracts numeric values from an array of table cells.
 * Can optionally skip header cells by checking the skipHeader option.
 * 
 * @example
 * // Returns [2, 3, 4]
 * const cells = Array.from(document.querySelectorAll('td'));
 * extractNumericValues(cells, { skipHeader: true });
 * 
 * @param cells - Array of table cells to extract numbers from
 * @param [options] - Configuration options
 * @param [options.skipHeader=false] - Whether to skip cells in the first row (header row)
 * @returns An array of extracted numeric values
 */
export function extractNumericValues(
  cells: HTMLTableCellElement[],
  options: { skipHeader?: boolean } = {}
): number[] {
  const values: number[] = []
  const cellArray = Array.isArray(cells) ? cells : Array.from(cells)
  
  // If skipHeader is true, we need to determine how many cells are in the first row
  // to skip all of them
  if (options.skipHeader && cellArray.length > 0) {
    // Find the first row by traversing up to the row element
    const firstCell = cellArray[0] as HTMLTableCellElement
    const firstRow = firstCell.closest('tr')
    
    if (firstRow) {
      // Skip all cells that are in the first row
      const headerCells = Array.from(firstRow.cells)
      const filteredCells = cellArray.filter(
        (cell): cell is HTMLTableCellElement => 
          !headerCells.includes(cell as HTMLTableCellElement)
      )
      
      // Process remaining cells
      for (const cell of filteredCells) {
        const text = cell.textContent?.trim() || ''
        const num = parseFloat(text)
        if (!isNaN(num)) {
          values.push(num)
        }
      }
      
      return values
    }
  }
  
  // Default processing when not skipping header or no header found
  for (const cell of cellArray as HTMLTableCellElement[]) {
    const text = cell.textContent?.trim() || ''
    const num = parseFloat(text)
    if (!isNaN(num)) {
      values.push(num)
    }
  }
  
  return values
}
