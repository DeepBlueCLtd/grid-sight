import { injectPlusIcons, removePlusIcons, plusIconStyles } from './header-utils';
import { removeAllMenus } from './enrichment-menu';
import { analyzeTable } from '../core/table-detection';
import { toggleHeatmap } from '../enrichments/heatmap';
import { calculateStatistics } from '../enrichments/statistics';
import { analyzeFrequencies } from '../utils/frequency';
import { cleanNumericCell } from '../core/type-detection';
import { StatisticsPopup } from './statistics-popup';
import { FrequencyDialog } from './frequency-dialog';

// CSS class names for the toggle element
const TOGGLE_CLASS = 'grid-sight-toggle';
const TOGGLE_CONTAINER_CLASS = 'grid-sight-toggle-container';
const TOGGLE_ACTIVE_CLASS = 'grid-sight-toggle--active';
const TABLE_ENABLED_CLASS = 'grid-sight-enabled';

// Add type declarations for global popup instances
declare global {
  interface Window {
    _gsStatisticsPopup?: StatisticsPopup;
    _gsFrequencyDialog?: FrequencyDialog;
  }
}

// Add styles for plus icons
const styleElement = document.createElement('style');
styleElement.textContent = plusIconStyles;
document.head.appendChild(styleElement);

// ARIA labels for accessibility
const ARIA_LABEL = 'Toggle Grid-Sight';
const ARIA_EXPANDED = 'false';

/**
 * Creates the Grid-Sight toggle element.
 * @returns The HTMLElement for the toggle.
 */
export function createToggleElement(): HTMLElement {
  // Create container for the toggle
  const container = document.createElement('div');
  container.className = TOGGLE_CONTAINER_CLASS;
  
  // Create the toggle button
  const toggle = document.createElement('button');
  toggle.className = TOGGLE_CLASS;
  toggle.textContent = 'GS';
  
  // ARIA attributes for accessibility
  toggle.setAttribute('aria-label', ARIA_LABEL);
  toggle.setAttribute('aria-expanded', ARIA_EXPANDED);
  toggle.setAttribute('role', 'button');
  toggle.setAttribute('tabindex', '0');
  
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
  `;
  
  // Add hover and active states
  toggle.addEventListener('mouseenter', () => {
    toggle.style.background = '#e8e8e8';
    toggle.style.borderColor = '#999';
  });
  
  toggle.addEventListener('mouseleave', () => {
    toggle.style.background = '#f8f8f8';
    toggle.style.borderColor = '#ccc';
  });
  
  // Click handler will be added in injectToggle
  
  // Add keyboard support
  toggle.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle.click();
    }
  });
  
  container.appendChild(toggle);
  return container;
}

/**
 * Handles enrichment selection from the menu
 */
function handleEnrichmentSelected(event: Event) {
  const customEvent = event as CustomEvent<{
    type: 'row' | 'column';
    enrichmentType: string;
    header: HTMLElement;
    headerIndex: number;
  }>;
  
  const { type, enrichmentType, header, headerIndex } = customEvent.detail;
  
  console.log(`Enrichment selected: ${enrichmentType} for ${type} header at index ${headerIndex}`);
  
  const table = header.closest('table');
  if (!table) return;

    // Create statistics popup instance if it doesn't exist
  if (!window._gsStatisticsPopup) {
    window._gsStatisticsPopup = new StatisticsPopup();
  }

  // Handle menu item selection
  if (enrichmentType === 'heatmap') {
    if (type === 'column') {
      // Type assertion for table header cell
      const th = header as HTMLTableCellElement;
      const columnIndex = th.cellIndex;
      if (columnIndex >= 0) {
        toggleHeatmap(table, columnIndex, 'column');
      }
    } else if (type === 'row') {
      // Get the row index (0-based) and add 1 to make it 1-based for CSS nth-child
      const rowIndex = Array.from(header.closest('tr')?.parentElement?.children || []).indexOf(header.closest('tr') as HTMLTableRowElement);
      if (rowIndex >= 0) {
        // Add 1 to make the index 1-based for CSS nth-child selector
        toggleHeatmap(table, rowIndex + 1, 'row');
      }
    }
  } else if (enrichmentType === 'statistics' && type === 'column') {
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
  } else if (enrichmentType === 'frequency' && type === 'column') {
    // Type assertion for table header cell
    const th = header as HTMLTableCellElement;
    const columnIndex = th.cellIndex;
    if (columnIndex >= 0) {
      try {
        // Get all cell values from the column
        const rows = Array.from(table.rows);
        const values = rows.map(row => {
          const cell = row.cells[columnIndex];
          return cell ? cell.textContent || '' : '';
        });
        
        // Calculate frequencies
        const frequencyResult = analyzeFrequencies(values);
        
        // Create or reuse frequency dialog instance
        if (!window._gsFrequencyDialog) {
          window._gsFrequencyDialog = new FrequencyDialog();
        }
        
        // Show the dialog with the frequency results
        const columnName = th.textContent?.trim() || `Column ${columnIndex + 1}`;
        window._gsFrequencyDialog.show(frequencyResult, header, { columnName });
      } catch (error) {
        console.error('Error performing frequency analysis:', error);
        alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
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
    });
    
    header.dispatchEvent(enrichmentEvent);
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
  const values: number[] = [];
  
  // Get all rows in the tbody
  const rows = table.tBodies[0]?.rows || [];
  
  for (let i = 0; i < rows.length; i++) {
    const cell = rows[i].cells[columnIndex];
    if (!cell) continue;
    
    const value = cleanNumericCell(cell.textContent || '');
    if (value !== null) {
      values.push(value);
    }
  }
  
  return values;
}

export function injectToggle(table: HTMLTableElement): boolean {
  // Find the first cell in the first row of the thead
  const firstRow = table.tHead?.rows[0] || table.rows[0];
  if (!firstRow?.cells.length) {
    console.warn('Could not find a suitable cell to inject the Grid-Sight toggle');
    return false;
  }
  
  const firstCell = firstRow.cells[0];
  
  // Check if a toggle already exists in this table
  if (firstCell.querySelector(`.${TOGGLE_CLASS}, .${TOGGLE_CONTAINER_CLASS}`)) {
    return false;
  }
  
  try {
    const toggleElement = createToggleElement();
    const toggle = toggleElement.querySelector(`.${TOGGLE_CLASS}`);
    
    // Insert the toggle as the first child of the cell
    firstCell.insertBefore(toggleElement, firstCell.firstChild);
    
    // Add click handler for the toggle
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const container = toggle.closest(`.${TOGGLE_CONTAINER_CLASS}`);
        const isActive = toggle.classList.toggle(TOGGLE_ACTIVE_CLASS);
        container?.classList.toggle(TOGGLE_ACTIVE_CLASS, isActive);
        toggle.setAttribute('aria-expanded', String(isActive));
        
        // Dispatch custom event when toggle is clicked
        const toggleEvent = new CustomEvent('gridsight:toggle', {
          bubbles: true,
          detail: { active: isActive, target: e.target }
        });
        toggle.dispatchEvent(toggleEvent);
        
        if (isActive) {
          table.classList.add(TABLE_ENABLED_CLASS);
          // Extract table data and analyze column types
          const rows = Array.from(table.rows).map(row => 
            Array.from(row.cells).map(cell => cell.textContent || '')
          );
          const { columnTypes } = analyzeTable(rows);
          // Inject plus icons
          injectPlusIcons(table, columnTypes);
          
          // Add click handler for enrichment selection
          table.addEventListener('gridsight:enrichmentSelected', handleEnrichmentSelected as EventListener);
        } else {
          table.classList.remove(TABLE_ENABLED_CLASS);
          // Remove plus icons, menus, and event listeners when toggling off
          removePlusIcons(table);
          removeAllMenus();
          table.removeEventListener('gridsight:enrichmentSelected', handleEnrichmentSelected as EventListener);
        }
      });
    }
    
    // Add a class to the table to indicate it has Grid-Sight enabled
    table.classList.add('grid-sight-enabled');
    
    return true;
  } catch (error) {
    console.error('Failed to inject Grid-Sight toggle:', error);
    return false;
  }
}
