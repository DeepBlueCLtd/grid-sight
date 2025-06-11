// CSS class names for the toggle element
const TOGGLE_CLASS = 'grid-sight-toggle';
const TOGGLE_CONTAINER_CLASS = 'grid-sight-toggle-container';
const TOGGLE_ACTIVE_CLASS = 'grid-sight-toggle--active';

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
  
  // Add click handler (placeholder for future functionality)
  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const isActive = toggle.classList.toggle(TOGGLE_ACTIVE_CLASS);
    toggle.setAttribute('aria-expanded', String(isActive));
    
    // Dispatch custom event when toggle is clicked
    const toggleEvent = new CustomEvent('gridsight:toggle', {
      bubbles: true,
      detail: { active: isActive, target: event.target }
    });
    toggle.dispatchEvent(toggleEvent);
  });
  
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
    
    // Insert the toggle as the first child of the cell
    firstCell.insertBefore(toggleElement, firstCell.firstChild);
    
    // Add a class to the table to indicate it has Grid-Sight enabled
    table.classList.add('grid-sight-enabled');
    
    return true;
  } catch (error) {
    console.error('Failed to inject Grid-Sight toggle:', error);
    return false;
  }
}
