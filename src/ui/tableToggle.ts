/**
 * UI component for the Grid-Sight toggle button
 */

import { dispatchGridSightEvent, EVENTS } from '../core/events'
import { showContextMenu } from './contextMenu'

// Track which tables already have toggles
const tableToggles = new WeakMap<HTMLTableElement, HTMLDivElement>()

/**
 * Clean up all toggles and clear the toggle cache
 * This should be called when the story changes
 */
export const cleanupToggles = (): void => {
  // Remove all toggle elements from the DOM
  document.querySelectorAll('.grid-sight-toggle').forEach(toggle => {
    toggle.remove()
  })
  
  // Clear the WeakMap (though this isn't strictly necessary as it's a WeakMap)
  // The main purpose is to remove the DOM elements
}

/**
 * Create and inject a Grid-Sight toggle button for a table
 * @param table - The table element to create a toggle for
 */
export const createTableToggle = (table: HTMLTableElement): void => {
  // Check if this table already has a toggle
  if (tableToggles.has(table)) {
    return // Skip if toggle already exists for this table
  }

  // Create toggle element
  const toggle = document.createElement('div')
  toggle.className = 'grid-sight-toggle'
  toggle.setAttribute('role', 'button')
  toggle.setAttribute('tabindex', '0')
  toggle.setAttribute('aria-label', 'Toggle Grid-Sight data visualization')
  
  // Store reference to this toggle
  tableToggles.set(table, toggle)
  
  // Set initial state
  let isActive = false
  updateToggleState(toggle, isActive)
  
  // Position the toggle near the top-right of the table
  positionToggle(toggle, table)
  
  // Add click event listener
  toggle.addEventListener('click', () => {
    isActive = !isActive
    updateToggleState(toggle, isActive)
    
    // Dispatch appropriate event
    if (isActive) {
      dispatchGridSightEvent(EVENTS.TOGGLE_ACTIVATED, { tableElement: table })
      addPlusIcons(table)
    } else {
      dispatchGridSightEvent(EVENTS.TOGGLE_DEACTIVATED, { tableElement: table })
      removePlusIcons(table)
    }
  })
  
  // Add keyboard event listener for accessibility
  toggle.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggle.click()
    }
  })
  
  // Add the toggle to the document
  document.body.appendChild(toggle)
}

/**
 * Update the toggle button's visual state
 * @param toggle - The toggle element
 * @param isActive - Whether the toggle is active
 */
const updateToggleState = (toggle: HTMLElement, isActive: boolean): void => {
  if (isActive) {
    toggle.classList.add('active')
    toggle.setAttribute('aria-pressed', 'true')
    toggle.textContent = 'GS'
  } else {
    toggle.classList.remove('active')
    toggle.setAttribute('aria-pressed', 'false')
    toggle.textContent = 'GS'
  }
}

/**
 * Position the toggle button relative to the table
 * @param toggle - The toggle element
 * @param table - The table element
 */
const positionToggle = (toggle: HTMLElement, table: HTMLTableElement): void => {
  const tableRect = table.getBoundingClientRect()
  
  // Position the toggle at the top-right of the table
  toggle.style.position = 'absolute'
  toggle.style.top = `${tableRect.top + window.scrollY}px`
  toggle.style.left = `${tableRect.right + window.scrollX - 40}px`
  
  // Add basic styling
  toggle.style.backgroundColor = '#2c3e50'
  toggle.style.color = 'white'
  toggle.style.padding = '4px 8px'
  toggle.style.borderRadius = '4px'
  toggle.style.cursor = 'pointer'
  toggle.style.zIndex = '1000'
  toggle.style.fontSize = '14px'
  toggle.style.fontWeight = 'bold'
}

/**
 * Add plus icons to table headers when Grid-Sight is activated
 * @param table - The table element
 */
const addPlusIcons = (table: HTMLTableElement): void => {
  // Add plus icons to column headers
  const headerCells = table.querySelectorAll('thead th')
  headerCells.forEach(cell => {
    const plusIcon = document.createElement('span')
    plusIcon.className = 'grid-sight-plus-icon'
    plusIcon.textContent = '+'
    plusIcon.style.marginLeft = '5px'
    plusIcon.style.cursor = 'pointer'
    
    // Add click event to show context menu
    plusIcon.addEventListener('click', (event) => {
      showContextMenu(event as MouseEvent, table, true) // true for column
    })
    
    // Add keyboard accessibility
    plusIcon.setAttribute('tabindex', '0')
    plusIcon.setAttribute('role', 'button')
    plusIcon.setAttribute('aria-label', 'Show column options')
    plusIcon.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        plusIcon.click()
      }
    })
    
    cell.appendChild(plusIcon)
  })
  
  // Add plus icons to the first cell of each row in tbody
  const rows = table.querySelectorAll('tbody tr')
  rows.forEach(row => {
    const firstCell = row.querySelector('td')
    if (firstCell) {
      const plusIcon = document.createElement('span')
      plusIcon.className = 'grid-sight-plus-icon'
      plusIcon.textContent = '+'
      plusIcon.style.marginRight = '5px'
      plusIcon.style.cursor = 'pointer'
      
      // Add click event to show context menu
      plusIcon.addEventListener('click', (event) => {
        showContextMenu(event as MouseEvent, table, false) // false for row
      })
      
      // Add keyboard accessibility
      plusIcon.setAttribute('tabindex', '0')
      plusIcon.setAttribute('role', 'button')
      plusIcon.setAttribute('aria-label', 'Show row options')
      plusIcon.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          plusIcon.click()
        }
      })
      
      firstCell.insertBefore(plusIcon, firstCell.firstChild)
    }
  })
}

/**
 * Remove plus icons from table when Grid-Sight is deactivated
 * @param table - The table element
 */
const removePlusIcons = (table: HTMLTableElement): void => {
  const plusIcons = table.querySelectorAll('.grid-sight-plus-icon')
  plusIcons.forEach(icon => {
    icon.remove()
  })
}