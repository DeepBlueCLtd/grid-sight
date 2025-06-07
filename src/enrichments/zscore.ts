/**
 * Z-Score enrichment module
 * Identifies outliers in numeric data using Z-score calculation
 */

/**
 * Calculate Z-scores for a set of numeric values
 * @param values - Array of numeric values
 * @returns Array of Z-scores corresponding to the input values
 */
export const calculateZScores = (values: number[]): number[] => {
  // Calculate mean
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  
  // Calculate standard deviation
  const squaredDifferences = values.map(value => Math.pow(value - mean, 2))
  const variance = squaredDifferences.reduce((sum, value) => sum + value, 0) / values.length
  const stdDev = Math.sqrt(variance)
  
  // Calculate Z-scores
  return values.map(value => (value - mean) / (stdDev || 1)) // Avoid division by zero
}

/**
 * Identify outliers based on Z-scores and a threshold
 * @param cells - Array of table cells to analyze
 * @param threshold - Z-score threshold for outlier detection (default: 2.0)
 * @returns Object containing outlier cells and their Z-scores
 */
export const identifyOutliers = (
  cells: HTMLTableCellElement[],
  threshold = 2.0
): { cell: HTMLTableCellElement; value: number; zScore: number }[] => {
  // Extract numeric values from cells
  const numericData: { cell: HTMLTableCellElement; value: number }[] = []
  
  cells.forEach(cell => {
    const value = parseFloat(cell.textContent?.trim() || '')
    
    if (!isNaN(value)) {
      numericData.push({ cell, value })
    }
  })
  
  // If no numeric values found, return empty array
  if (numericData.length === 0) return []
  
  // Calculate Z-scores
  const values = numericData.map(item => item.value)
  const zScores = calculateZScores(values)
  
  // Identify outliers
  const outliers = numericData.map((item, index) => ({
    cell: item.cell,
    value: item.value,
    zScore: zScores[index]
  })).filter(item => Math.abs(item.zScore) > threshold)
  
  return outliers
}

/**
 * Apply visual highlighting to outlier cells
 * @param outliers - Array of outlier cells with their Z-scores
 */
export const highlightOutliers = (
  outliers: { cell: HTMLTableCellElement; value: number; zScore: number }[]
): void => {
  outliers.forEach(({ cell, zScore }) => {
    // Add outlier class and data attribute
    cell.classList.add('grid-sight-outlier')
    cell.setAttribute('data-zscore', zScore.toFixed(2))
    
    // Add visual indicator
    const isPositive = zScore > 0
    
    cell.style.border = `2px solid ${isPositive ? 'red' : 'blue'}`
    cell.style.position = 'relative'
    
    // Add tooltip with Z-score information
    cell.title = `Z-Score: ${zScore.toFixed(2)}`
  })
}

/**
 * Remove outlier highlighting from cells
 * @param cells - Array of table cells to remove highlighting from
 */
export const removeOutlierHighlighting = (cells: HTMLTableCellElement[]): void => {
  cells.forEach(cell => {
    cell.classList.remove('grid-sight-outlier')
    cell.removeAttribute('data-zscore')
    cell.style.border = ''
    cell.title = ''
  })
}