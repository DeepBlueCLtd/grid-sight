/**
 * Custom state management for Grid-Sight
 */

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

// Custom event for state changes
export const STATE_CHANGE_EVENT = 'grid-sight-state-change'

// Create the state object
class StateManager {
  private _state: GridSightState = {
    tables: new Map(),
    globalSettings: {
      enabled: true
    }
  }

  // Get a copy of the current state
  get state(): GridSightState {
    return this._state
  }

  // Update the state and notify subscribers
  private updateState(newState: Partial<GridSightState>): void {
    // Update the state
    this._state = { ...this._state, ...newState }
    
    // Dispatch an event to notify subscribers
    const event = new CustomEvent(STATE_CHANGE_EVENT, { detail: this._state })
    document.dispatchEvent(event)
  }

  // Update global settings
  updateGlobalSettings(settings: Partial<GridSightState['globalSettings']>): void {
    this._state.globalSettings = { ...this._state.globalSettings, ...settings }
    this.updateState(this._state)
  }

  // Get the tables Map
  get tables(): Map<HTMLTableElement, TableConfig> {
    return this._state.tables
  }
}

// Create a singleton instance
export const stateManager = new StateManager()

// Export a reference to the state for convenience
export const state = stateManager.state

/**
 * Register a table with the state management system
 * @param table - The table element to register
 */
export const registerTable = (table: HTMLTableElement): void => {
  if (!stateManager.tables.has(table)) {
    stateManager.tables.set(table, {
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
    
    // Notify subscribers of the change
    const event = new CustomEvent(STATE_CHANGE_EVENT, { detail: stateManager.state })
    document.dispatchEvent(event)
  }
}

/**
 * Get the configuration for a specific table
 * @param table - The table element
 * @returns The table configuration or undefined if not registered
 */
export const getTableConfig = (table: HTMLTableElement): TableConfig | undefined => {
  return stateManager.tables.get(table)
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
  const currentConfig = stateManager.tables.get(table)
  
  if (currentConfig) {
    stateManager.tables.set(table, {
      ...currentConfig,
      ...updates
    })
    
    // Notify subscribers of the change
    const event = new CustomEvent(STATE_CHANGE_EVENT, { detail: stateManager.state })
    document.dispatchEvent(event)
  }
}

/**
 * Subscribe to state changes
 * @param callback - Function to call when state changes
 */
export const subscribeToStateChanges = (callback: (state: GridSightState) => void): () => void => {
  const handler = (event: CustomEvent<GridSightState>) => {
    callback(event.detail)
  }
  
  document.addEventListener(STATE_CHANGE_EVENT, handler as EventListener)
  
  // Return unsubscribe function
  return () => {
    document.removeEventListener(STATE_CHANGE_EVENT, handler as EventListener)
  }
}