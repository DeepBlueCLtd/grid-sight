/**
 * Normalizes a cell value for frequency analysis
 * - Converts to string
 * - Trims whitespace
 * - Converts to lowercase for case-insensitive comparison
 * - Handles empty/whitespace as "[Empty]"
 */
function normalizeCellValue(value: unknown): string {
  // Convert to string and trim
  const strValue = String(value ?? '').trim()
  
  // Handle empty/whitespace
  if (strValue === '') {
    return '[Empty]'
  }
  
  return strValue.toLowerCase()
}

/**
 * Calculates frequency distribution of values in an array
 * @param values - Array of values to analyze
 * @returns Object mapping normalized values to their frequency counts
 */
function calculateFrequency(values: unknown[]): Record<string, number> {
  const frequencyMap: Record<string, number> = {}
  
  for (const value of values) {
    const normalized = normalizeCellValue(value)
    frequencyMap[normalized] = (frequencyMap[normalized] || 0) + 1
  }
  
  return frequencyMap
}

/**
 * Sorts frequency results alphabetically by value
 */
function sortFrequencies(frequencies: Record<string, number>): Array<[string, number]> {
  return Object.entries(frequencies).sort(([a], [b]) => a.localeCompare(b))
}

/**
 * Calculates frequency distribution with percentages
 * @returns Array of [value, count, percentage] tuples, sorted alphabetically
 */
function analyzeFrequencies(values: unknown[]): Array<[string, number, number]> {
  const total = values.length
  if (total === 0) return []
  
  const frequencies = calculateFrequency(values)
  const sorted = sortFrequencies(frequencies)
  
  return sorted.map(([value, count]) => [
    value,
    count,
    Math.round((count / total) * 1000) / 10 // Round to 1 decimal place
  ])
}

export {
  normalizeCellValue,
  calculateFrequency,
  analyzeFrequencies,
  sortFrequencies
}
