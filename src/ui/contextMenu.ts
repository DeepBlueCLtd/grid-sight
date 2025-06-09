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
    const allTableRows = Array.from(tableElement.querySelectorAll('tr'))
    if (allTableRows.length === 0) return cells

    const firstRow = allTableRows[0]
    // Ensure firstRow and its cells exist and are not empty
    if (!firstRow || !firstRow.cells || firstRow.cells.length === 0) {
        console.warn('Grid-Sight: First row or its cells not found or empty for column selection.')
        return cells
    }
    const headerCells = Array.from(firstRow.cells) // Works for <th> or <td>
    let columnIndex = -1

    // Find which header cell (from the first row) contains the target plus icon
    headerCells.forEach((cell, index) => {
      if (cell.contains(targetElement)) { // targetElement is the plus icon
        columnIndex = index
      }
    })
    
    // Fallback: if targetElement is not contained by any cell (e.g. it's a direct child of the cell)
    // and the targetElement's parent is one of the headerCells.
    if (columnIndex === -1 && targetElement.parentElement) {
        const parentCellIndex = headerCells.indexOf(targetElement.parentElement as HTMLTableCellElement)
        if (parentCellIndex !== -1) {
            columnIndex = parentCellIndex
        }
    }

    if (columnIndex === -1) {
      console.warn('Grid-Sight: Could not determine column index for context menu action. Target:', targetElement, 'Header cells:', headerCells)
      return cells
    }

    // Get all cells in that column from all rows
    // This includes the header cell itself, which is fine for heatmap/z-score calculations
    allTableRows.forEach(row => {
      if (row.cells && row.cells[columnIndex]) {
        cells.push(row.cells[columnIndex])
      }
    })
  } else { // isRow
    const iconContainerCell = targetElement.parentElement // The cell containing the plus icon
    if (!iconContainerCell) {
        console.warn('Grid-Sight: Plus icon has no parent cell for row selection.')
        return cells
    }
    const rowElement = iconContainerCell.closest('tr')
    
    if (rowElement && rowElement.cells && rowElement.cells.length > 0) {
      // Get all cells from this row.
      cells.push(...Array.from(rowElement.cells))
    } else {
        console.warn('Grid-Sight: Could not find row element or its cells for row selection. Target:', targetElement)
    }
  }
  
  return cells
}