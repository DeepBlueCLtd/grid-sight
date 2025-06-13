import { injectPlusIcons, removePlusIcons, plusIconStyles } from './header-utils';
import type { HeaderType } from './header-utils';
import { removeAllMenus } from './enrichment-menu';
import { analyzeTable } from '../core/table-detection';
import { toggleHeatmap } from '../enrichments/heatmap';
import { calculateStatistics } from '../enrichments/statistics';
import { analyzeFrequencies } from '../utils/frequency';
import { cleanNumericCell } from '../core/type-detection';
import { StatisticsPopup } from './statistics-popup';
import { FrequencyDialog } from './frequency-dialog';
import { FrequencyChartDialog } from './frequency-chart-dialog';

// CSS class names for the toggle element
const TOGGLE_CLASS = 'grid-sight-toggle'
const TOGGLE_CONTAINER_CLASS = 'grid-sight-toggle-container'
const TOGGLE_ACTIVE_CLASS = 'grid-sight-toggle--active'
const TABLE_ENABLED_CLASS = 'grid-sight-enabled'

// Add type declarations for global popup instances
declare global {
  interface Window {
    _gsStatisticsPopup?: StatisticsPopup;
    _gsFrequencyDialog?: FrequencyDialog;
    _gsFrequencyChartDialog?: FrequencyChartDialog;
  }
}

// Add styles for plus icons
const styleElement = document.createElement('style')
styleElement.textContent = plusIconStyles
document.head.appendChild(styleElement)

// ARIA labels for accessibility
const ARIA_LABEL = 'Toggle Grid-Sight'
const ARIA_EXPANDED = 'false'

/**
 * Creates the Grid-Sight toggle element.
 * @returns The HTMLElement for the toggle.
 */
export function createToggleElement(): HTMLElement {
  // Create container for the toggle
  const container = document.createElement('div')
  container.className = TOGGLE_CONTAINER_CLASS
  
  // Create the toggle button
  const toggle = document.createElement('button')
  toggle.className = TOGGLE_CLASS
  toggle.textContent = 'GS'
  
  // ARIA attributes for accessibility
  toggle.setAttribute('aria-label', ARIA_LABEL)
  toggle.setAttribute('aria-expanded', ARIA_EXPANDED)
  toggle.setAttribute('role', 'button')
  toggle.setAttribute('tabindex', '0')
  
  // Add hover and focus styles via JavaScript (can be overridden by CSS)
  toggle.style.cssText = `
    cursor: pointer;
    border: 1px solid #ccc;
    background: #f8f8f8;
    border-radius: 3px;
    padding: 2px 6px;
    font-size: 11px;
    font-weight: bold;
    color: #555;
    margin-right: 8px;
    vertical-align: middle;
    transition: all 0.2s ease;
  `
  
  // Add hover and active states
  toggle.addEventListener('mouseenter', () => {
    toggle.style.background = '#e8e8e8'
    toggle.style.borderColor = '#999'
  })
  
  toggle.addEventListener('mouseleave', () => {
    toggle.style.background = '#f8f8f8'
    toggle.style.borderColor = '#ccc'
  })
  
  // Click handler will be added in injectToggle
  
  // Add keyboard support
  toggle.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggle.click()
    }
  })
  
  container.appendChild(toggle)
  return container
}

/**
 * Handles enrichment selection from the menu
 */
function handleEnrichmentSelected(event: Event) {
  const customEvent = event as CustomEvent<{
    type: HeaderType;
    enrichmentType: string;
    header: HTMLElement;
    headerIndex: number;
  }>
  
  const { type, enrichmentType, header, headerIndex } = customEvent.detail
  
  console.log(`Enrichment selected: ${enrichmentType} for ${type} header at index ${headerIndex}`)
  
  const table = header.closest('table')
  if (!table) return

  // Create statistics popup instance if it doesn't exist
  if (!window._gsStatisticsPopup) {
    window._gsStatisticsPopup = new StatisticsPopup()
  }

  // Handle menu item selection
  if (enrichmentType === 'heatmap') {
    if (type === 'column') {
      // Type assertion for table header cell
      const th = header as HTMLTableCellElement
      const columnIndex = th.cellIndex
      if (columnIndex >= 0) {
        toggleHeatmap(table, columnIndex, 'column')
      }
    } else if (type === 'row') {
      // Get the row index (0-based) and add 1 to make it 1-based for CSS nth-child
      const rowIndex = Array.from(header.closest('tr')?.parentElement?.children || []).indexOf(header.closest('tr') as HTMLTableRowElement)
      if (rowIndex >= 0) {
        // Add 1 to make the index 1-based for CSS nth-child selector
        toggleHeatmap(table, rowIndex + 1, 'row')
      }
    } else if (type === 'table') {
      // Toggle heatmap on all numeric cells in the table
      toggleHeatmap(table, -1, 'table');
    }
  } else if (enrichmentType === 'statistics') {
    if (type === 'column') {
      // Type assertion for table header cell
      const th = header as HTMLTableCellElement;
      const columnIndex = th.cellIndex;
      if (columnIndex >= 0) {
        try {
          const values = extractNumericColumnValues(table, columnIndex);
          const stats = calculateStatistics(values);
          window._gsStatisticsPopup.show(stats, header);
        } catch (error) {
          console.error('Error calculating statistics:', error);
          alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } else if (type === 'row') {
      // Type assertion for table row
      const tr = header.closest('tr') as HTMLTableRowElement;
      if (!tr) {
        console.error('Could not find row');
        return;
      }
      
      try {
        const values = extractNumericRowValues(tr);
        if (values.length === 0) {
          alert('No numeric values found in this row');
          return;
        }
        
        const stats = calculateStatistics(values);
        window._gsStatisticsPopup.show(stats, header);
      } catch (error) {
        console.error('Error calculating statistics for row:', error);
        alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else if (type === 'table') {
      try {
        const values = extractNumericTableValues(table);
        if (values.length === 0) {
          alert('No numeric values found in this table');
          return;
        }
        
        const stats = calculateStatistics(values);
        window._gsStatisticsPopup.show(stats, header);
      } catch (error) {
        console.error('Error calculating statistics for table:', error);
        alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  } else if ((enrichmentType === 'frequency' || enrichmentType === 'frequency-chart')) {
    try {
      let values: string[] = []
      let itemName = ''
      
      if (type === 'column') {
        // Type assertion for table header cell
        const th = header as HTMLTableCellElement
        const columnIndex = th.cellIndex
        if (columnIndex < 0) {
          throw new Error('Invalid column index')
        }
        
        // Get all cell values from the column, excluding the header row
        const rows = Array.from(table.rows)
        values = rows
          .filter((_, rowIndex) => rowIndex > 0) // Skip the header row
          .map((row) => {
            const cell = row.cells[columnIndex]
            return cell ? cell.textContent || '' : ''
          })
        
        // Get column name
        itemName = th.textContent?.trim() || `Column ${columnIndex + 1}`
      } else if (type === 'row') {
        // Type assertion for table row
        const tr = header.closest('tr') as HTMLTableRowElement
        if (!tr) {
          throw new Error('Could not find row')
        }
        
        // Get row index
        const rowIndex = tr.rowIndex
        
        // Get all cell values from the row, excluding the first cell if it's a header
        const cells = Array.from(tr.cells)
        const startIndex = cells.length > 0 && cells[0].tagName.toLowerCase() === 'th' ? 1 : 0
        
        values = cells.slice(startIndex).map((cell) => cell.textContent || '')
        
        // Get row name/identifier (typically first cell or row number)
        itemName = cells.length > 0 ? 
          (cells[0].textContent?.trim() || `Row ${rowIndex + 1}`) : 
          `Row ${rowIndex + 1}`
      } else {
        throw new Error('Unsupported enrichment target type')
      }
      
      // Calculate frequencies
      const frequencyResult = analyzeFrequencies(values)
      
      if (enrichmentType === 'frequency') {
        // Create or reuse frequency dialog instance
        if (!window._gsFrequencyDialog) {
          window._gsFrequencyDialog = new FrequencyDialog()
        }
        
        // Show the dialog with the frequency results
        window._gsFrequencyDialog.show(frequencyResult, header, { columnName: itemName })
      } else if (enrichmentType === 'frequency-chart') {
        // Create or reuse frequency chart dialog instance
        if (!window._gsFrequencyChartDialog) {
          window._gsFrequencyChartDialog = new FrequencyChartDialog()
        }
        
        // Show the chart dialog with the frequency results
        window._gsFrequencyChartDialog.show(frequencyResult, header, { columnName: itemName })
      }
    } catch (error) {
      console.error('Error calculating frequencies:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  // Dispatch event for the specific enrichment type
  // Only dispatch if we haven't already handled it completely
  if (enrichmentType !== 'statistics') {
    const enrichmentEvent = new CustomEvent(`gridsight:enrichment:${enrichmentType}`, {
      bubbles: true,
      detail: {
        type,
        header,
        headerIndex
      }
    })
    
    header.dispatchEvent(enrichmentEvent)
  }
}

/**
 * Injects the Grid-Sight toggle into the top-left cell of the given table.
 * @param table The HTMLTableElement to inject the toggle into.
 * @returns True if the toggle was injected, false otherwise.
 */
/**
 * Extracts numeric values from a table column
 */
function extractNumericColumnValues(table: HTMLTableElement, columnIndex: number): number[] {
  const values: number[] = []
  
  // Get all rows in the tbody
  const rows = table.tBodies[0]?.rows || []
  
  for (let i = 0; i < rows.length; i++) {
    const cell = rows[i].cells[columnIndex]
    if (!cell) continue
    
    const value = cleanNumericCell(cell.textContent || '')
    if (value !== null) {
      values.push(value)
    }
  }
  
  return values
}

/**
 * Extracts numeric values from a table row
 */
function extractNumericRowValues(row: HTMLTableRowElement): number[] {
  const values: number[] = [];
  
  // Get all cells in the row
  const cells = Array.from(row.cells);
  
  // Skip the first cell if it's a header
  const startIndex = cells.length > 0 && cells[0].tagName.toLowerCase() === 'th' ? 1 : 0;
  
  for (let i = startIndex; i < cells.length; i++) {
    const value = cleanNumericCell(cells[i].textContent || '');
    if (value !== null) {
      values.push(value);
    }
  }
  
  return values;
}

/**
 * Extracts all numeric values from a table, excluding headers
 */
function extractNumericTableValues(table: HTMLTableElement): number[] {
  const values: number[] = [];
  
  // Get all rows in the table
  const rows = Array.from(table.rows);
  
  // Skip the header row(s)
  // If there's a thead, skip all rows in it
  // Otherwise, skip the first row as it's likely a header
  const startIndex = table.tHead ? table.tHead.rows.length : 1;
  
  // Process all non-header rows
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    
    // Get all cells in the row
    const cells = Array.from(row.cells);
    
    // Skip the first cell if it's a header
    const cellStartIndex = cells.length > 0 && cells[0].tagName.toLowerCase() === 'th' ? 1 : 0;
    
    // Process all non-header cells
    for (let j = cellStartIndex; j < cells.length; j++) {
      const value = cleanNumericCell(cells[j].textContent || '');
      if (value !== null) {
        values.push(value);
      }
    }
  }
  
  return values;
}

export function injectToggle(table: HTMLTableElement): boolean {
  // Find the first cell in the first row of the thead
  const firstRow = table.tHead?.rows[0] || table.rows[0]
  if (!firstRow?.cells.length) {
    console.warn('Could not find a suitable cell to inject the Grid-Sight toggle')
    return false
  }
  
  const firstCell = firstRow.cells[0]
  
  // Check if a toggle already exists in this table
  if (firstCell.querySelector(`.${TOGGLE_CLASS}, .${TOGGLE_CONTAINER_CLASS}`)) {
    return false
  }
  
  try {
    const toggleElement = createToggleElement()
    const toggle = toggleElement.querySelector(`.${TOGGLE_CLASS}`)
    
    // Insert the toggle as the first child of the cell
    firstCell.insertBefore(toggleElement, firstCell.firstChild)
    
    // Add click handler for the toggle
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation()
        const container = toggle.closest(`.${TOGGLE_CONTAINER_CLASS}`)
        const isActive = toggle.classList.toggle(TOGGLE_ACTIVE_CLASS)
        container?.classList.toggle(TOGGLE_ACTIVE_CLASS, isActive)
        toggle.setAttribute('aria-expanded', String(isActive))
        
        // Dispatch custom event when toggle is clicked
        const toggleEvent = new CustomEvent('gridsight:toggle', {
          bubbles: true,
          detail: { active: isActive, target: e.target }
        })
        toggle.dispatchEvent(toggleEvent)
        
        if (isActive) {
          table.classList.add(TABLE_ENABLED_CLASS)
          // Extract table data and analyze column types
          const rows = Array.from(table.rows).map((row) => 
            Array.from(row.cells).map((cell) => cell.textContent || '')
          )
          const { columnTypes } = analyzeTable(rows)
          // Inject plus icons
          injectPlusIcons(table, columnTypes)
          
          // Add click handler for enrichment selection
          table.addEventListener('gridsight:enrichmentSelected', handleEnrichmentSelected as EventListener)
        } else {
          table.classList.remove(TABLE_ENABLED_CLASS)
          // Remove plus icons, menus, and event listeners when toggling off
          removePlusIcons(table)
          removeAllMenus()
          table.removeEventListener('gridsight:enrichmentSelected', handleEnrichmentSelected as EventListener)
        }
      })
    }
    
    // Add a class to the table to indicate it has Grid-Sight enabled
    table.classList.add('grid-sight-enabled')
    
    return true
  } catch (error) {
    console.error('Failed to inject Grid-Sight toggle:', error)
    return false
  }
}
