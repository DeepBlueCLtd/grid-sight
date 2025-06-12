import { 
  mean, 
  median, 
  min, 
  max, 
  standardDeviation, 
  variance as sampleVariance,
  sum
} from 'simple-statistics'

export interface StatisticsResult {
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  variance: number;
}

/**
 * Calculates statistics for an array of numbers
 * @param values Array of numbers to analyze
 * @returns StatisticsResult object with calculated values
 */
export function calculateStatistics(values: number[]): StatisticsResult {
  if (!values.length) {
    throw new Error('Cannot calculate statistics for an empty array')
  }

  // Filter out any non-finite numbers
  const validValues = values.filter(Number.isFinite)
  
  if (validValues.length === 0) {
    throw new Error('No valid numeric values provided')
  }

  return {
    count: validValues.length,
    sum: sum(validValues),
    min: min(validValues),
    max: max(validValues),
    mean: mean(validValues),
    median: median(validValues),
    stdDev: standardDeviation(validValues),
    variance: sampleVariance(validValues)
  }
}

/**
 * Formats a number to a specified number of decimal places
 * @param value The number to format
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted number as a string
 */
export function formatNumber(value: number, decimals: number = 2): string {
  if (!Number.isFinite(value)) return 'N/A'
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  })
}

/**
 * Converts statistics to a formatted string
 * @param stats StatisticsResult object
 * @returns Formatted string with statistics
 */
export function formatStatistics(stats: StatisticsResult): string {
  return [
    `Count: ${stats.count}`,
    `Sum: ${formatNumber(stats.sum)}`,
    `Min: ${formatNumber(stats.min)}`,
    `Max: ${formatNumber(stats.max)}`,
    `Mean: ${formatNumber(stats.mean)}`,
    `Median: ${formatNumber(stats.median)}`,
    `Std Dev: ${formatNumber(stats.stdDev)}`,
    `Variance: ${formatNumber(stats.variance)}`
  ].join('\n')
}
