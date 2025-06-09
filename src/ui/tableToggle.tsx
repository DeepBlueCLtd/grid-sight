/**
 * UI component for the Grid-Sight toggle button
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Root } from 'react-dom/client'
import { dispatchGridSightEvent, EVENTS } from '../core/events'
import { showContextMenu } from './contextMenu'

// Track which tables already have toggles
const tableToggles = new WeakMap<HTMLTableElement, HTMLButtonElement>()

/**
 * Clean up all toggles and clear the toggle cache
 * This should be called when the story changes
 */
export const cleanupToggles = (): void => {
  // Remove all toggle elements from the DOM
  document.querySelectorAll('.grid-sight-toggle-container').forEach(container => {
    container.remove()
  })
}

interface TableToggleProps {
  table: HTMLTableElement
}

/**
 * React component for the Grid-Sight toggle button
 */
const TableToggle: React.FC<TableToggleProps> = ({ table }) => {
  const [isActive, setIsActive] = useState(false)
  const containerRef: React.MutableRefObject<HTMLDivElement | null> = useRef<HTMLDivElement | null>(null)
const toggleRef: React.MutableRefObject<HTMLButtonElement | null> = useRef<HTMLButtonElement | null>(null)

  // Position the toggle next to the table on mount
  useEffect(() => {
    if (!containerRef.current || !toggleRef.current) return

    // Store reference to this toggle
    if (tableToggles.has(table)) return
    tableToggles.set(table, toggleRef.current)

    // Style the container
    const container = containerRef.current
    Object.assign(container.style, {
      display: 'inline-flex',
      alignItems: 'flex-start',
      verticalAlign: 'top',
      margin: '1em 0'
    })

    // Wrap the table in the container
    const parent = table.parentNode
    if (!parent) return

    parent.insertBefore(container, table)
    container.appendChild(table)

    return () => {
      // Cleanup on unmount
      if (container.parentNode) {
        container.parentNode.insertBefore(table, container)
        container.remove()
      }
    }
  }, [table])

  const handleToggle = useCallback(() => {
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

  return <div ref={containerRef} className='grid-sight-toggle-container'>
      <button
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
    </div>
}

/**
 * Create and inject a Grid-Sight toggle button for a table
 * @param table - The table element to create a toggle for
 */
// Keep track of created roots for cleanup
const tableRoots = new WeakMap<HTMLTableElement, { root: Root; container: HTMLElement }>()

export const createTableToggle = (table: HTMLTableElement): void => {
  // Check if this table already has a toggle
  if (tableToggles.has(table)) {
    return // Skip if toggle already exists for this table
  }

  // Create a container for the React component
  const container = document.createElement('div')
  document.body.appendChild(container)

  // Import React and render the component
  Promise.all([
    import('react'), // Import React for JSX
    import('react-dom/client')
  ]).then(([_, { createRoot }]) => { // Use underscore for unused React import
    const root = createRoot(container)
    root.render(<TableToggle table={table} />)
    tableRoots.set(table, { root, container })
  }).catch(error => {
    console.error('Failed to load React:', error)
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
