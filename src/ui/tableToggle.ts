/**
 * UI component for the Grid-Sight toggle button, implemented in vanilla JS/TS.
 */
import { dispatchGridSightEvent, EVENTS } from '../core/events'
import { showContextMenu } from './contextMenu'

// Track which tables already have toggles
const tableToggles = new WeakMap<HTMLTableElement, HTMLButtonElement>()
// tableRoots is no longer needed as we are not using React for this component.

/**
 * Clean up all toggles and clear the toggle cache
 * This should be called when the story changes
 */
export const cleanupToggles = (): void => {
  // Remove all toggle button containers from the DOM.
  document.querySelectorAll('.grid-sight-toggle-container').forEach(container => {
    // Check if the container still has a parent before removing, to avoid errors if already removed.
    if (container.parentNode) {
      container.parentNode.removeChild(container)
    }
  })
  // tableToggles WeakMap will clear as buttons are removed and garbage collected.
  // No need to iterate tableToggles explicitly for cleanup.
}

/**
 * Create and inject a Grid-Sight toggle button for a table
 * @param table - The table element to create a toggle for
 */
export const createTableToggle = (table: HTMLTableElement): void => {
  if (tableToggles.has(table)) {
    console.log('Grid-Sight: Toggle already exists for this table. Skipping.')
    return
  }

  const parent = table.parentNode
  if (!parent) {
    console.error('Grid-Sight: Table has no parent node. Cannot inject toggle.', table)
    return
  }

  // Create the button element
  const button = document.createElement('button')
  button.className = 'grid-sight-toggle'
  button.setAttribute('role', 'button')
  button.tabIndex = 0
  button.setAttribute('aria-label', 'Toggle Grid-Sight data visualization')
  button.textContent = 'GS'

  // Style the button
  Object.assign(button.style, {
    backgroundColor: '#2c3e50',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    marginLeft: '10px', // Keep margin on the button itself
    border: 'none',
  })

  // State for the toggle (managed per button)
  let isActive = false
  button.setAttribute('aria-pressed', String(isActive))

  // Event handler for toggle logic
  const handleToggle = () => {
    isActive = !isActive
    button.setAttribute('aria-pressed', String(isActive))

    if (isActive) {
      dispatchGridSightEvent(EVENTS.TOGGLE_ACTIVATED, { tableElement: table })
      addPlusIcons(table)
    } else {
      dispatchGridSightEvent(EVENTS.TOGGLE_DEACTIVATED, { tableElement: table })
      removePlusIcons(table)
    }
  }

  // Attach event listeners
  button.addEventListener('click', handleToggle)
  button.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleToggle()
    }
  })

  // Create a wrapper div that will contain the toggle button and the table
  const wrapperDiv = document.createElement('div')
  wrapperDiv.className = 'grid-sight-toggle-container'
  Object.assign(wrapperDiv.style, {
    display: 'inline-flex',
    alignItems: 'flex-start',
    verticalAlign: 'top',
    margin: '1em 0' // Apply overall margin to the wrapper
  })

  // Replace the original table with the wrapperDiv in the DOM
  parent.replaceChild(wrapperDiv, table)

  // Add the button and the original table into the wrapper
  wrapperDiv.appendChild(button) // Add button first
  wrapperDiv.appendChild(table)

  // Store a reference to the created button for this table
  tableToggles.set(table, button)
}

/**
 * Add plus icons to table headers when Grid-Sight is activated
 * @param table - The table element
 */
const addPlusIcons = (table: HTMLTableElement): void => {
  // Add plus icons to column headers
  const headerCells = table.querySelectorAll('thead th')
  headerCells.forEach(cell => {
    // Create a container for the React component
    const container = document.createElement('span')
    cell.appendChild(container)
    
    // Create the plus icon element
    const plusIcon = document.createElement('span')
    plusIcon.className = 'grid-sight-plus-icon'
    plusIcon.textContent = '+'
    plusIcon.style.marginLeft = '5px'
    plusIcon.style.cursor = 'pointer'
    plusIcon.tabIndex = 0
    plusIcon.setAttribute('role', 'button')
    plusIcon.setAttribute('aria-label', 'Show column options')
    
    // Add event listeners
    const handleClick = (event: MouseEvent) => {
      showContextMenu(event, table, true) // true for column
    }
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        showContextMenu(event as unknown as MouseEvent, table, true) // true for column
      }
    }
    
    plusIcon.addEventListener('click', handleClick)
    plusIcon.addEventListener('keydown', handleKeyDown)
    container.appendChild(plusIcon)
  })
  
  // Add plus icons to the first cell of each row in tbody
  const rows = table.querySelectorAll('tbody tr')
  rows.forEach(row => {
    const firstCell = row.querySelector('td')
    if (!firstCell) return
    
    // Create the plus icon element
    const plusIcon = document.createElement('span')
    plusIcon.className = 'grid-sight-plus-icon'
    plusIcon.textContent = '+'
    plusIcon.style.marginRight = '5px'
    plusIcon.style.cursor = 'pointer'
    plusIcon.tabIndex = 0
    plusIcon.setAttribute('role', 'button')
    plusIcon.setAttribute('aria-label', 'Show row options')
    
    // Add event listeners
    const handleClick = (event: MouseEvent) => {
      showContextMenu(event, table, false) // false for row
    }
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        // Pass the icon itself as the target for positioning if needed, or use event.target
        showContextMenu(event as unknown as MouseEvent, table, false)
      }
    }
    
    plusIcon.addEventListener('click', handleClick)
    plusIcon.addEventListener('keydown', handleKeyDown)
    firstCell.insertBefore(plusIcon, firstCell.firstChild)
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
