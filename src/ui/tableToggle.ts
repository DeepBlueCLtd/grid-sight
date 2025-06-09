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
  const allRows = Array.from(table.querySelectorAll('tr'))
  if (allRows.length === 0) return

  // Add plus icons to cells of the first row (assumed headers for columns)
  const firstRowCells = Array.from(allRows[0].cells)
  firstRowCells.forEach(cell => {
    const plusIcon = document.createElement('span')
    plusIcon.className = 'grid-sight-plus-icon grid-sight-column-icon'
    plusIcon.textContent = '+'
    plusIcon.style.marginLeft = '5px'
    plusIcon.style.cursor = 'pointer'
    plusIcon.tabIndex = 0
    plusIcon.setAttribute('role', 'button')
    plusIcon.setAttribute('aria-label', 'Show column options')

    const handleClick = (event: MouseEvent) => {
      showContextMenu(event, table, true) // true for column
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        showContextMenu(event as unknown as MouseEvent, table, true)
      }
    }
    plusIcon.addEventListener('click', handleClick)
    plusIcon.addEventListener('keydown', handleKeyDown)
    // Prepend to keep icon before text, append if it should be after
    cell.insertBefore(plusIcon, cell.firstChild) 
  })

  // Add plus icons to the first cell of each subsequent row (for row operations)
  // Starting from the second row (index 1) to avoid duplicating on the header row's first cell
  allRows.slice(1).forEach(row => {
    const firstCellInRow = row.cells[0]
    if (!firstCellInRow) return

    const plusIcon = document.createElement('span')
    plusIcon.className = 'grid-sight-plus-icon grid-sight-row-icon'
    plusIcon.textContent = '+'
    plusIcon.style.marginRight = '5px' // For icons at the start of the cell content
    plusIcon.style.cursor = 'pointer'
    plusIcon.tabIndex = 0
    plusIcon.setAttribute('role', 'button')
    plusIcon.setAttribute('aria-label', 'Show row options')

    const handleClick = (event: MouseEvent) => {
      showContextMenu(event, table, false) // false for row
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        showContextMenu(event as unknown as MouseEvent, table, false)
      }
    }
    plusIcon.addEventListener('click', handleClick)
    plusIcon.addEventListener('keydown', handleKeyDown)
    firstCellInRow.insertBefore(plusIcon, firstCellInRow.firstChild)
  })
}

/**
 * Remove plus icons from table when Grid-Sight is deactivated
 * @param table - The table element
 */
const removePlusIcons = (table: HTMLTableElement): void => {
  // Remove all plus icons, whether they are column or row icons
  const plusIcons = table.querySelectorAll('.grid-sight-plus-icon')
  plusIcons.forEach(icon => {
    if (icon.parentNode) {
      icon.parentNode.removeChild(icon)
    }
  })
}
