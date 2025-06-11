/**
 * Table Processor Module
 * 
 * Handles the core functionality for processing and enriching HTML tables.
 */

/**
 * Options for table processing
 */
export interface TableProcessorOptions {
  /** Unique identifier for the table */
  id?: string;
  /** Whether to apply default styling */
  applyStyles?: boolean;
  /** Callback when processing is complete */
  onComplete?: (table: HTMLTableElement) => void;
}

/**
 * Process a table element and apply enrichments
 * @param table The table element to process
 * @param options Processing options
 */
export function processTable(
  table: HTMLTableElement,
  options: TableProcessorOptions = {}
): HTMLTableElement {
  // Apply default options
  const {
    id = `table-${Math.random().toString(36).substr(2, 9)}`,
    applyStyles = true,
    onComplete
  } = options;

  // Ensure the table has an ID
  if (!table.id) {
    table.id = id;
  }

  try {
    // Add a data attribute to mark the table as processed
    table.dataset.gridSightProcessed = 'true';

    // Apply default styles if enabled
    if (applyStyles) {
      applyTableStyles(table);
    }

    // Process table data
    processTableData(table);

    // Call the completion callback if provided
    if (typeof onComplete === 'function') {
      onComplete(table);
    }

    return table;
  } catch (error) {
    console.error('Error processing table:', error);
    throw error;
  }
}

/**
 * Process table data (placeholder for future enrichments)
 * @param table The table to process
 */
function processTableData(table: HTMLTableElement): void {
  // This is a placeholder for future table processing logic
  // For now, we'll just add a data attribute to each cell
  const cells = table.querySelectorAll('td, th');
  cells.forEach((cell, index) => {
    if (!cell.hasAttribute('data-gs-cell-index')) {
      cell.setAttribute('data-gs-cell-index', index.toString());
    }
  });
}

/**
 * Apply default styles to the table
 * @param table The table to style
 */
function applyTableStyles(table: HTMLTableElement): void {
  // Add a class to the table for styling
  table.classList.add('grid-sight-table');

  // Add some basic default styles if no styles are already applied
  if (!document.querySelector('style[data-grid-sight-styles]')) {
    const style = document.createElement('style');
    style.setAttribute('data-grid-sight-styles', 'true');
    style.textContent = `
      .grid-sight-table {
        border-collapse: collapse;
        width: 100%;
        margin: 1em 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }
      .grid-sight-table th,
      .grid-sight-table td {
        border: 1px solid #ddd;
        padding: 8px 12px;
        text-align: left;
      }
      .grid-sight-table th {
        background-color: #f5f5f5;
        font-weight: 600;
      }
      .grid-sight-table tr:nth-child(even) {
        background-color: #f9f9f9;
      }
      .grid-sight-table tr:hover {
        background-color: #f1f1f1;
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Check if a table is valid (has both thead and tbody)
 * @param table The table element to check
 */
export function isValidTable(table: HTMLTableElement): boolean {
  return table && 
         table instanceof HTMLTableElement && 
         table.tHead !== null && 
         table.tBodies.length > 0;
}
