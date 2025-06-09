/**
 * UI component for the Grid-Sight toggle button
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Root } from 'react-dom/client'
import { dispatchGridSightEvent, EVENTS } from '../core/events'
import { showContextMenu } from './contextMenu'

// Track which tables already have toggles
const tableToggles = new WeakMap<HTMLTableElement, HTMLButtonElement>()
// Keep track of created roots for cleanup
const tableRoots = new WeakMap<HTMLTableElement, { root: Root; container: HTMLElement }>()

/**
 * Clean up all toggles and clear the toggle cache
 * This should be called when the story changes
 */
export const cleanupToggles = (): void => {
  // Unmount React roots and remove their containers
  for (const tableKey of (typeof tableRoots !== 'undefined' ? Object.keys(tableRoots) : [])) {
    const entry = tableRoots.get(tableKey as any) // Cast needed if keys aren't perfect
    if (entry) {
      try {
        entry.root.unmount()
      } catch (e) {
        console.warn('Grid-Sight: Error unmounting React root during cleanup', e)
      }
      entry.container.remove()
      tableRoots.delete(tableKey as any)
    }
  }

  // Remove all toggle button containers (if any were missed or structured differently)
  document.querySelectorAll('.grid-sight-toggle-container').forEach(container => {
    container.remove()
  })

  // The tableToggles WeakMap (for button elements) will clear as elements are removed and GC'd.
}

interface TableToggleProps {
  table: HTMLTableElement
}

/**
 * React component for the Grid-Sight toggle button
 */
const TableToggle: React.FC<TableToggleProps> = ({ table }) => {
  const [isActive, setIsActive] = useState(false)
  
const toggleRef: React.MutableRefObject<HTMLButtonElement | null> = useRef<HTMLButtonElement | null>(null)

  // Effect for button-specific logic
  useEffect(() => {
    if (!toggleRef.current) return

    // Store reference to this toggle button
    if (!tableToggles.has(table)) {
      tableToggles.set(table, toggleRef.current)
    }

    return () => {
      // Cleanup on unmount if needed, e.g. if tableToggles needed explicit delete
      // tableToggles.delete(table) // WeakMap handles this if buttonEl is GC'd
    }
  }, [table]) // Depends on table for the WeakMap key

  const handleToggle = useCallback(() => {
    console.log('toggle', table)
    const newActiveState = !isActive
    setIsActive(newActiveState)

    // Dispatch appropriate event
    if (newActiveState) {
      dispatchGridSightEvent(EVENTS.TOGGLE_ACTIVATED, { tableElement: table })
      addPlusIcons(table)
    } else {
      dispatchGridSightEvent(EVENTS.TOGGLE_DEACTIVATED, { tableElement: table })
      removePlusIcons(table)
    }
  }, [isActive, table])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleToggle()
    }
  }, [handleToggle])

  return <button
        ref={toggleRef}
        className='grid-sight-toggle'
        role="button"
        tabIndex={0}
        aria-label='Toggle Grid-Sight data visualization'
        aria-pressed={isActive}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        style={{
          backgroundColor: '#2c3e50',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          marginLeft: '10px',
          border: 'none',
        }}
      >
        GS
      </button>
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

  // Create a wrapper div that will contain the toggle and the table
  const wrapperDiv = document.createElement('div')
  wrapperDiv.className = 'grid-sight-toggle-container' // Used for cleanup and potential styling
  Object.assign(wrapperDiv.style, {
    display: 'inline-flex',
    alignItems: 'flex-start',
    verticalAlign: 'top',
    margin: '1em 0' // Apply margin to the wrapper
  })

  // Create a mount point for the React component (the button)
  const reactMountPoint = document.createElement('div')
  // reactMountPoint.style.marginRight = '10px' // If button needs margin from table

  // Replace the original table with the wrapperDiv
  parent.replaceChild(wrapperDiv, table)

  // Add the React mount point and the original table into the wrapper
  wrapperDiv.appendChild(reactMountPoint)
  wrapperDiv.appendChild(table)

  // Import React and render the component into the mount point
  Promise.all([
    import('react'),
    import('react-dom/client')
  ]).then(([_, { createRoot }]) => {
    const root = createRoot(reactMountPoint)
    root.render(<TableToggle table={table} />)
    // Store the wrapperDiv for cleanup, as it's the outermost container we created
    tableRoots.set(table, { root, container: wrapperDiv })
  }).catch(error => {
    console.error('Grid-Sight: Failed to load React or render toggle:', error)
  })
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
        showContextMenu(event as unknown as MouseEvent, table, false) // false for row
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
