import { injectPlusIcons, removePlusIcons, plusIconStyles } from './header-utils';
import { analyzeTable } from '../core/table-detection';

// CSS class names for the toggle element
const TOGGLE_CLASS = 'grid-sight-toggle';
const TOGGLE_CONTAINER_CLASS = 'grid-sight-toggle-container';
const TOGGLE_ACTIVE_CLASS = 'grid-sight-toggle--active';
const TABLE_ENABLED_CLASS = 'grid-sight-enabled';

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
 * Injects the Grid-Sight toggle into the top-left cell of the given table.
 * @param table The HTMLTableElement to inject the toggle into.
 * @returns True if the toggle was injected, false otherwise.
 */
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
        } else {
          table.classList.remove(TABLE_ENABLED_CLASS);
          // Remove plus icons when toggling off
          removePlusIcons(table);
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
