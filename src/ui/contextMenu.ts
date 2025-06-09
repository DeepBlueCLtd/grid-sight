/**
 * Context menu component for Grid-Sight
 */

import { applyHeatmap, removeHeatmap } from '../enrichments/heatmap'
import { identifyOutliers, highlightOutliers, removeOutlierHighlighting } from '../enrichments/zscore'
import { dispatchGridSightEvent, EVENTS } from '../core/events'

/**
 * Create and show a context menu for a plus icon
 * @param event - The click event
 * @param tableElement - The table element
 * @param isColumn - Whether this is a column header (true) or row header (false)
 */
export const showContextMenu = (
  event: MouseEvent, 
  tableElement: HTMLTableElement, 
  isColumn: boolean
): void => {
  event.preventDefault()
  event.stopPropagation()
  
  // Remove any existing context menus
  removeContextMenu()
  
  // Create context menu
  const contextMenu = document.createElement('div')
  contextMenu.className = 'grid-sight-context-menu'
  // Basic styling for the context menu
  Object.assign(contextMenu.style, {
    backgroundColor: 'white', // Solid background
    border: '1px solid #ccc',    // Border
    borderRadius: '4px',         // Rounded corners
    padding: '5px 0',            // Padding
    boxShadow: '2px 2px 5px rgba(0,0,0,0.2)', // Subtle shadow
    zIndex: '10000'             // Ensure it's on top
  })
  
  // Add menu items
  const menuItems = [
    { label: 'Apply Heatmap', action: () => applyHeatmapToSelection(tableElement, isColumn, event.target as HTMLElement) },
    { label: 'Detect Outliers', action: () => detectOutliers(tableElement, isColumn, event.target as HTMLElement) },
    { label: 'Clear Enrichments', action: () => clearEnrichments(tableElement, isColumn, event.target as HTMLElement) }
  ]
  
  menuItems.forEach(item => {
    const menuItem = document.createElement('div')
    menuItem.className = 'grid-sight-context-menu-item'
    menuItem.textContent = item.label
    // Basic styling for menu items
    Object.assign(menuItem.style, {
      padding: '8px 15px',       // Padding
      cursor: 'pointer'          // Cursor
    })
    // Hover effect for menu items
    menuItem.addEventListener('mouseenter', () => {
      menuItem.style.backgroundColor = '#f0f0f0' // Light grey background on hover
    })
    menuItem.addEventListener('mouseleave', () => {
      menuItem.style.backgroundColor = 'white'   // Revert on mouse leave
    })
    menuItem.addEventListener('click', () => {
      item.action()
      removeContextMenu()
    })
    contextMenu.appendChild(menuItem)
  })
  
  // Position the menu near the click
  contextMenu.style.position = 'absolute'
  contextMenu.style.left = `${event.pageX}px`
  contextMenu.style.top = `${event.pageY}px`
  
  // Add to document
  document.body.appendChild(contextMenu)
  
  // Close menu when clicking outside
  document.addEventListener('click', removeContextMenu, { once: true })
}

/**
 * Remove any open context menu
 */
export const removeContextMenu = (): void => {
  const existingMenu = document.querySelector('.grid-sight-context-menu')
  if (existingMenu) {
    existingMenu.remove()
  }
}

/**
 * Apply heatmap to a column or row
 * @param tableElement - The table element
 * @param isColumn - Whether to apply to a column (true) or row (false)
 * @param targetElement - The element that was clicked
 */
const applyHeatmapToSelection = (
  tableElement: HTMLTableElement, 
  isColumn: boolean, 
  targetElement: HTMLElement
): void => {
  const cells = getCellsForSelection(tableElement, isColumn, targetElement)
  
  if (cells.length > 0) {
    // Apply heatmap to the selected cells
    applyHeatmap(cells)
    
    // Dispatch event
    dispatchGridSightEvent(EVENTS.ENRICHMENT_APPLIED, {
      tableElement,
      enrichmentType: 'heatmap',
      cells
    })
  }
}

/**
 * Detect outliers in a column or row
 * @param tableElement - The table element
 * @param isColumn - Whether to apply to a column (true) or row (false)
 * @param targetElement - The element that was clicked
 */
const detectOutliers = (
  tableElement: HTMLTableElement, 
  isColumn: boolean, 
  targetElement: HTMLElement
): void => {
  const cells = getCellsForSelection(tableElement, isColumn, targetElement)
  
  if (cells.length > 0) {
    // Identify outliers using Z-score
    const outliers = identifyOutliers(cells)
    
    // Highlight the outliers
    highlightOutliers(outliers)
    
    // Dispatch event
    dispatchGridSightEvent(EVENTS.ENRICHMENT_APPLIED, {
      tableElement,
      enrichmentType: 'zscore',
      cells,
      outliers
    })
  }
}

/**
 * Clear all enrichments from a column or row
 * @param tableElement - The table element
 * @param isColumn - Whether to clear a column (true) or row (false)
 * @param targetElement - The element that was clicked
 */
const clearEnrichments = (
  tableElement: HTMLTableElement, 
  isColumn: boolean, 
  targetElement: HTMLElement
): void => {
  const cells = getCellsForSelection(tableElement, isColumn, targetElement)
  
  if (cells.length > 0) {
    // Remove heatmap
    removeHeatmap(cells)
    
    // Remove outlier highlighting
    removeOutlierHighlighting(cells)
    
    // Dispatch event
    dispatchGridSightEvent(EVENTS.ENRICHMENT_REMOVED, {
      tableElement,
      cells
    })
  }
}

/**
 * Get cells for a column or row selection
 * @param tableElement - The table element
 * @param isColumn - Whether to get cells for a column (true) or row (false)
 * @param targetElement - The element that was clicked
 * @returns Array of table cell elements
 */
const getCellsForSelection = (
  tableElement: HTMLTableElement, 
  isColumn: boolean, 
  targetElement: HTMLElement
): HTMLTableCellElement[] => {
  const cells: HTMLTableCellElement[] = []
  
  if (isColumn) {
    // Find the column index
    const headerRow = tableElement.querySelector('thead tr')
    if (!headerRow) return cells
    
    const headerCells = Array.from(headerRow.querySelectorAll('th'))
    let columnIndex = -1
    
    // Find which header contains the target element
    headerCells.forEach((cell, index) => {
      if (cell.contains(targetElement)) {
        columnIndex = index
      }
    })
    
    if (columnIndex === -1) return cells
    
    // Get all cells in this column (skip header)
    const rows = tableElement.querySelectorAll('tbody tr')
    rows.forEach(row => {
      const cell = row.querySelectorAll('td')[columnIndex]
      if (cell) {
        cells.push(cell as HTMLTableCellElement)
      }
    })
  } else {
    // Find the row
    const rows = Array.from(tableElement.querySelectorAll('tbody tr'))
    let targetRow: Element | null = null
    
    // Find which row contains the target element
    for (const row of rows) {
      if (row.contains(targetElement)) {
        targetRow = row
        break
      }
    }
    
    if (!targetRow) return cells
    
    // Get all cells in this row (skip first cell if it's the one with the plus icon)
    const rowCells = Array.from(targetRow.querySelectorAll('td'))
    
    // If the first cell contains the target, we want all cells except the first
    if (rowCells[0] && (rowCells[0] as Element).contains(targetElement)) {
      cells.push(...rowCells.slice(1) as HTMLTableCellElement[])
    } else {
      // Otherwise get all cells
      cells.push(...rowCells as HTMLTableCellElement[])
    }
  }
  
  return cells
}