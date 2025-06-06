/**
 * Heatmap enrichment module
 * Applies color shading to numeric cells based on their values
 */

/**
 * Apply heatmap coloring to a selection of cells
 * @param cells - Array of table cells to apply heatmap to
 */
export const applyHeatmap = (cells: HTMLTableCellElement[]): void => {
  // Extract numeric values from cells
  const numericValues: { cell: HTMLTableCellElement; value: number }[] = []
  
  cells.forEach(cell => {
    const value = parseFloat(cell.textContent?.trim() || '')
    
    if (!isNaN(value)) {
      numericValues.push({ cell, value })
    } else {
      // Non-numeric cells should be ignored or assigned neutral color
      cell.style.backgroundColor = 'transparent'
    }
  })
  
  // If no numeric values found, exit
  if (numericValues.length === 0) return
  
  // Find min and max values for scaling
  const values = numericValues.map(item => item.value)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  
  // Apply color shading based on value range
  numericValues.forEach(({ cell, value }) => {
    // Calculate normalized value between 0 and 1
    const normalizedValue = (value - minValue) / (maxValue - minValue)
    
    // Apply color based on normalized value
    const color = getHeatmapColor(normalizedValue)
    cell.style.backgroundColor = color
  })
}

/**
 * Get a color for the heatmap based on normalized value (0-1)
 * @param normalizedValue - Value between 0 and 1
 * @returns CSS color string
 */
export const getHeatmapColor = (normalizedValue: number): string => {
  // Simple blue to red gradient
  // Blue for low values, red for high values
  const r = Math.round(normalizedValue * 255)
  const b = Math.round((1 - normalizedValue) * 255)
  const g = 0
  
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Remove heatmap coloring from cells
 * @param cells - Array of table cells to remove heatmap from
 */
export const removeHeatmap = (cells: HTMLTableCellElement[]): void => {
  cells.forEach(cell => {
    cell.style.backgroundColor = ''
  })
}