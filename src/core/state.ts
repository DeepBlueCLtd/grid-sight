/**
 * State management for Grid-Sight using Valtio
 */

import { proxy } from 'valtio'
import { DataType } from './types'

// Define types for our state
interface TableConfig {
  isActive: boolean
  enrichments: {
    heatmap: boolean
    zScore: boolean
    search: boolean
  }
  settings: {
    heatmapColorScheme: string
    zScoreThreshold: number
  }
  // Column and row data type classifications
  columnTypes?: DataType[]
  rowTypes?: DataType[]
}

interface GridSightState {
  tables: Map<HTMLTableElement, TableConfig>
  globalSettings: {
    enabled: boolean
  }
}

// Create the proxy state
export const state = proxy<GridSightState>({
  tables: new Map(),
  globalSettings: {
    enabled: true
  }
})

/**
 * Register a table with the state management system
 * @param table - The table element to register
 */
export const registerTable = (table: HTMLTableElement): void => {
  if (!state.tables.has(table)) {
    state.tables.set(table, {
      isActive: false,
      enrichments: {
        heatmap: false,
        zScore: false,
        search: false
      },
      settings: {
        heatmapColorScheme: 'blue-red',
        zScoreThreshold: 2.0 // Default Z-score threshold as per requirements
      }
    })
  }
}

/**
 * Get the configuration for a specific table
 * @param table - The table element
 * @returns The table configuration or undefined if not registered
 */
export const getTableConfig = (table: HTMLTableElement): TableConfig | undefined => {
  return state.tables.get(table)
}

/**
 * Update the configuration for a specific table
 * @param table - The table element
 * @param updates - Partial updates to apply to the table config
 */
export const updateTableConfig = (
  table: HTMLTableElement, 
  updates: Partial<TableConfig>
): void => {
  const currentConfig = state.tables.get(table)
  
  if (currentConfig) {
    state.tables.set(table, {
      ...currentConfig,
      ...updates
    })
  }
}