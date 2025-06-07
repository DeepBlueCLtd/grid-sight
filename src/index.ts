/**
 * Grid-Sight - A library for enriching HTML tables with data visualization and analysis tools
 * @module grid-sight
 */

import { initTableDetection } from './core/tableDetection'
import { setupEventListeners } from './core/events'
import { version } from '../package.json'
import './ui/styles.css'

/**
 * Initialize Grid-Sight
 * @returns {void}
 */
export function initialize(): void {
  console.log(`Grid-Sight v${version} initialized`)
  
  // Set up event listeners for the application
  setupEventListeners()
  
  // Start table detection
  initTableDetection()
}

// Auto-initialize when loaded as a script
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initialize()
  })
}