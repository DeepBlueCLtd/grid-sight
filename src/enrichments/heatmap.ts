import { cleanNumericCell } from '../core/type-detection';

// Define heatmap type to include 'table' for table-wide heatmaps
export type HeatmapType = 'row' | 'column' | 'table';

const HEATMAP_CLASS = 'gs-heatmap';

// Color scale for the heatmap (from light yellow to dark red)
const HEATMAP_COLORS = [
  '#fff7ec', // lightest
  '#fee8c8',
  '#fdd49e',
  '#fdbb84',
  '#fc8d59',
  '#ef6548',
  '#d7301f', // darkest
];

interface HeatmapOptions {
  minValue?: number;
  maxValue?: number;
  colorScale?: string[];
}

// Store heatmap info for each table
interface TrackedCell {
  element: HTMLElement;
  heatmapType: HeatmapType;
  style: {
    removeProperty: (name: string) => void;
  };
}

interface HeatmapInfo {
  index: number;
  type: HeatmapType;
  cellElements: TrackedCell[]; // Track cell elements and their heatmap types for cleanup
};

declare global {
  interface HTMLElement {
    _heatmapInfos?: HeatmapInfo[];
  }
}

// Add hover and split cell styles for heatmaps
const style = document.createElement('style');
style.textContent = `
  .gs-heatmap-cell {
    transition: all 0.2s ease;
    position: relative;
  }
  .gs-heatmap-cell:hover {
    outline: 2px solid #1976d2;
    outline-offset: -1px;
    z-index: 1;
  }
  .gs-heatmap-split {
    position: relative;
    overflow: hidden;
    color: #000000;
    font-weight: 500;
    text-shadow: 0px 0px 2px rgba(255, 255, 255, 0.7);
    z-index: 1;
  }
  .gs-heatmap-split::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, var(--split-color-1, transparent) 0%, var(--split-color-1, transparent) 50%, var(--split-color-2, transparent) 50%, var(--split-color-2, transparent) 100%);
    pointer-events: none;
    z-index: -1;
  }`;
// Only add the style once
if (!document.head.querySelector('style[data-heatmap-styles]')) {
  style.setAttribute('data-heatmap-styles', '');
  document.head.appendChild(style);
}

// Track active heatmaps by table and index
type HeatmapKey = `${string}-${number}-${HeatmapType}`;
const activeHeatmaps = new Set<HeatmapKey>();

function getHeatmapKey(table: HTMLTableElement, index: number, type: HeatmapType): HeatmapKey {
  return `${table.id || table.dataset.gsId || 'table'}-${index}-${type}`;
}

export function isHeatmapActive(table: HTMLTableElement, index: number, type: HeatmapType): boolean {
  const key = getHeatmapKey(table, index, type);
  return activeHeatmaps.has(key);
}

function setHeatmapActive(table: HTMLTableElement, index: number, type: HeatmapType, active: boolean): void {
  const key = getHeatmapKey(table, index, type);
  if (active) {
    activeHeatmaps.add(key);
  } else {
    activeHeatmaps.delete(key);
  }
}

export function applyHeatmap(
  table: HTMLTableElement,
  index: number,
  type: HeatmapType = 'column',
  options: HeatmapOptions = {}
): void {
  // Handle table type separately - delegate to applyTableHeatmap
  if (type === 'table') {
    applyTableHeatmap(table, options);
    return;
  }
  if (isHeatmapActive(table, index, type)) {
    return;
  }
  
  const { minValue, maxValue, colorScale = HEATMAP_COLORS } = options;
  
  // Get all cells in the specified row or column
  const cells: HTMLTableCellElement[] = [];
  const values: number[] = [];
  
  // At this point, type can only be 'row' or 'column'
  const heatmapType = type as 'row' | 'column';
  
  if (heatmapType === 'column') {
    // For columns, get all cells in the specified column index (1-based for querySelector)
    // Try with tbody first, then fall back to direct tr children if no tbody exists
    const hasTbody = !!table.querySelector('tbody');
    const selector = hasTbody 
      ? `tbody tr:not(.gs-header-row) td:nth-child(${index + 1})`
      : `tr:not(.gs-header-row) td:nth-child(${index + 1})`;
      
    const columnCells = table.querySelectorAll<HTMLTableCellElement>(selector);
    
    columnCells.forEach((cell) => {
      const value = cleanNumericCell(cell.textContent || '');
      if (value !== null) {
        cells.push(cell);
        values.push(value);
      }
    });
  } else {
    // For rows, get all cells in the specified row index (1-based for rows)
    const row = table.querySelector<HTMLTableRowElement>(`tbody tr:nth-child(${index})`);
    if (row) {
      Array.from(row.cells).forEach((cell, cellIndex) => {
        // Skip the first cell if it's a row header
        if (cellIndex === 0 && cell.closest('th')) {
          return;
        }
        
        const value = cleanNumericCell(cell.textContent || '');
        if (value !== null) {
          cells.push(cell);
          values.push(value);
        }
      });
    }
  }
  
  if (values.length === 0) {
    console.warn('No numeric values found for heatmap');
    return;
  }
  
  // Calculate min and max values if not provided
  const min = minValue !== undefined ? minValue : Math.min(...values);
  const max = maxValue !== undefined ? maxValue : Math.max(...values);
  const range = max - min;
  
  // Track cell elements for cleanup and their heatmap types
  const trackedCellElements: Array<TrackedCell> = [];
  
  // Function to apply or update cell styling
  const applyCellStyle = (cell: HTMLElement, color: string, heatmapType: 'row' | 'column') => {
    // Check if this cell already has a heatmap of a different type
    const existingType = cell.dataset.heatmapType as 'row' | 'column' | undefined;
    
    if (existingType && existingType !== heatmapType) {
      // This cell has both row and column heatmaps - apply split style
      cell.classList.add('gs-heatmap-split');
      cell.style.setProperty('--split-color-1', existingType === 'row' ? cell.style.backgroundColor || '' : color);
      cell.style.setProperty('--split-color-2', existingType === 'column' ? cell.style.backgroundColor || '' : color);
      cell.style.backgroundColor = ''; // Clear solid background
    } else {
      // Single heatmap type for this cell
      cell.style.backgroundColor = color;
      cell.classList.remove('gs-heatmap-split');
      cell.style.removeProperty('--split-color-1');
      cell.style.removeProperty('--split-color-2');
    }
    
    // Track the heatmap type for this cell
    cell.dataset.heatmapType = heatmapType;
  };
  
  if (range === 0) {
    // All values are the same, use the middle color
    const colorIndex = Math.floor(colorScale.length / 2);
    const color = colorScale[colorIndex];
    
    // Apply color to all cells
    cells.forEach(cell => {
      applyCellStyle(cell, color, type);
      trackedCellElements.push({ element: cell, heatmapType: type, style: cell.style });
    });
  } else {
    // Different values, calculate color for each cell
    cells.forEach((cell, idx) => {
      const normalized = (values[idx] - min) / range;
      const colorIndex = Math.min(
        colorScale.length - 1,
        Math.max(0, Math.floor(normalized * colorScale.length))
      );
      
      applyCellStyle(cell, colorScale[colorIndex], type);
      trackedCellElements.push({ element: cell, heatmapType: type, style: cell.style });
    });
  }
  
  // Initialize _heatmapInfos if it doesn't exist
  if (!table._heatmapInfos) {
    table._heatmapInfos = [];
  }
  
  // Track the active heatmap
  setHeatmapActive(table, index, type, true);
  
  // Add the heatmap class to the table
  table.classList.add(HEATMAP_CLASS);
  
  // Store the heatmap info for cleanup
  table._heatmapInfos.push({
    index,
    type,
    cellElements: trackedCellElements.map(({ element, heatmapType }) => ({
      element,
      heatmapType,
      style: element.style
    }))
  });
  
  // Force a reflow to ensure styles are applied before the test checks them
  // This is needed for the test environment
  if (process.env.NODE_ENV === 'test') {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    table.offsetHeight;
  }
  
  // Dispatch event to notify about the heatmap change
  const event = new CustomEvent('gridsight:heatmapChanged', {
    bubbles: true,
    detail: { table, index, type, active: true }
  });
  table.dispatchEvent(event);
}

// Helper function to clean up a cell's heatmap styles and classes
function cleanupCell(cell: HTMLElement, heatmapType: HeatmapType): void {
  // If this cell has a split, we need to handle it specially
  if (cell.classList.contains('gs-heatmap-split')) {
    // Get the other heatmap type
    const otherType = heatmapType === 'row' ? 'column' : 'row';
    const otherColor = cell.style.getPropertyValue(`--split-color-${otherType === 'row' ? '1' : '2'}`);
    
    if (otherColor) {
      // Restore the other heatmap's color
      cell.style.backgroundColor = otherColor;
    } else {
      // No other heatmap, clear the background
      cell.style.removeProperty('background-color');
    }
    
    // Clean up split-related styles
    cell.classList.remove('gs-heatmap-split');
    cell.style.removeProperty('--split-color-1');
    cell.style.removeProperty('--split-color-2');
  } else {
    // Regular cell, just remove the background color
    cell.style.removeProperty('background-color');
  }
  
  // Remove the heatmap class and data attribute
  cell.classList.remove('gs-heatmap-cell');
  delete cell.dataset.heatmapType;
}

export function removeHeatmap(table: HTMLTableElement, index?: number, type?: HeatmapType): void {
  if (!table._heatmapInfos || table._heatmapInfos.length === 0) {
    return;
  }
  
  if (index !== undefined && type) {
    // Special case for table-wide heatmap - remove all heatmaps
    if (type === 'table') {
      // Remove all heatmaps as table-wide heatmap affects all cells
      removeHeatmap(table);
      return;
    }
    
    // Remove specific heatmap
    const heatmapIndex = table._heatmapInfos.findIndex(
      h => h.index === index && h.type === type
    );
    
    if (heatmapIndex !== -1) {
      const heatmap = table._heatmapInfos[heatmapIndex];
      
      // Remove cell styles
      heatmap.cellElements.forEach(({ element, heatmapType }) => {
        cleanupCell(element, heatmapType);
      });
      
      // Remove from active heatmaps
      setHeatmapActive(table, index, type, false);
      
      // Remove from the table's heatmap infos
      table._heatmapInfos.splice(heatmapIndex, 1);
      
      // If no more heatmaps, remove the heatmap class from the table
      if (table._heatmapInfos.length === 0) {
        table.classList.remove(HEATMAP_CLASS);
      }
      
      // Dispatch event for this specific heatmap removal
      const event = new CustomEvent('gridsight:heatmapChanged', {
        bubbles: true,
        detail: { table, index, type, active: false }
      });
      table.dispatchEvent(event);
      
      return;
    }
  } else {
    // Remove all heatmaps
    const heatmapsToRemove = [...(table._heatmapInfos || [])];
    
    heatmapsToRemove.forEach(heatmap => {
      
      // Remove cell styles
      heatmap.cellElements.forEach(({ element, heatmapType }) => {
        cleanupCell(element, heatmapType);
      });
      
      // Remove from active heatmaps
      setHeatmapActive(table, heatmap.index, heatmap.type, false);
    });
    
    // Clear all heatmap infos
    table._heatmapInfos = [];
    
    // Remove the heatmap class
    table.classList.remove(HEATMAP_CLASS);
    
    // Dispatch event for all heatmaps removed
    const event = new CustomEvent('gridsight:heatmapChanged', {
      bubbles: true,
      detail: { table, active: false }
    });
    table.dispatchEvent(event);
  }
}

/**
 * Apply heatmap to all numeric cells in the table
 * @param table The table element
 * @param options Heatmap options
 */
export function applyTableHeatmap(table: HTMLTableElement, options: HeatmapOptions = {}): void {
  if (isHeatmapActive(table, -1, 'table')) {
    return;
  }

  // Get all data cells in the table
  const cells: HTMLTableCellElement[] = [];
  const values: number[] = [];
  
  // Get all rows in the table
  const rows = Array.from(table.rows);
  
  // Skip the first row (headers) and process the rest
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    
    // Get all cells in the row
    const rowCells = Array.from(row.cells);
    
    // Process each cell
    rowCells.forEach(cell => {
      // Skip header cells (th elements or cells with header role)
      if (cell.tagName.toLowerCase() === 'th' || cell.getAttribute('role') === 'rowheader') {
        return;
      }
      
      // Check if the cell contains a numeric value
      const cellText = cell.textContent?.trim() || '';
      const numericValue = cleanNumericCell(cellText);
      
      if (numericValue !== null) {
        cells.push(cell);
        values.push(numericValue);
      }
    });
  }
  if (values.length === 0) {
    console.warn('No numeric values found for table-wide heatmap');
    return;
  }
  
  // Calculate min and max values if not provided
  const { minValue, maxValue, colorScale = HEATMAP_COLORS } = options;
  const min = minValue !== undefined ? minValue : Math.min(...values);
  const max = maxValue !== undefined ? maxValue : Math.max(...values);
  const range = max - min;
  
  // Track cell elements for cleanup
  const trackedCellElements: Array<TrackedCell> = [];
  
  // Use a special index for table-wide heatmap
  const tableHeatmapIndex = -1; // Use -1 as a special index for table-wide heatmap
  
  // Check if table-wide heatmap is already active
  if (isHeatmapActive(table, tableHeatmapIndex, 'table')) {
    // If active, remove it
    removeHeatmap(table, tableHeatmapIndex, 'table');
    return;
  }
  
  if (range === 0) {
    // All values are the same, use the middle color
    const colorIndex = Math.floor(colorScale.length / 2);
    const color = colorScale[colorIndex];
    
    // Apply color to all cells
    cells.forEach(cell => {
      cell.style.backgroundColor = color;
      cell.classList.add('gs-heatmap-cell');
      cell.dataset.heatmapType = 'table';
      trackedCellElements.push({ element: cell, heatmapType: 'table', style: cell.style });
    });
  } else {
    // Different values, calculate color for each cell
    cells.forEach((cell, idx) => {
      const normalized = (values[idx] - min) / range;
      const colorIndex = Math.min(
        colorScale.length - 1,
        Math.max(0, Math.floor(normalized * colorScale.length))
      );
      
      cell.style.backgroundColor = colorScale[colorIndex];
      cell.classList.add('gs-heatmap-cell');
      cell.dataset.heatmapType = 'table';
      trackedCellElements.push({ element: cell, heatmapType: 'table', style: cell.style });
    });
  }
  
  // Initialize _heatmapInfos if it doesn't exist
  if (!table._heatmapInfos) {
    table._heatmapInfos = [];
  }
  
  // Track the active heatmap
  setHeatmapActive(table, tableHeatmapIndex, 'table', true);
  
  // Add the heatmap class to the table
  table.classList.add(HEATMAP_CLASS);
  
  // Store the heatmap info for cleanup
  table._heatmapInfos.push({
    index: tableHeatmapIndex,
    type: 'table',
    cellElements: trackedCellElements
  });
  
  // Force a reflow to ensure styles are applied before the test checks them
  // This is needed for the test environment
  if (process.env.NODE_ENV === 'test') {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    table.offsetHeight;
  }
  
  // Dispatch event to notify about the heatmap change
  const event = new CustomEvent('gridsight:heatmapChanged', {
    bubbles: true,
    detail: { table, index: tableHeatmapIndex, type: 'table', active: true }
  });
  table.dispatchEvent(event);
}

export function toggleHeatmap(
  table: HTMLTableElement,
  index: number,
  type: HeatmapType = 'column',
  options: HeatmapOptions = {}
): void {
  if (type === 'table') {
    // For table-wide heatmap, delegate to applyTableHeatmap
    applyTableHeatmap(table, options);
    return;
  }
  
  // Check if this specific heatmap is already active
  const isActive = isHeatmapActive(table, type === 'table' ? -1 : index, type);
  

  if (isActive) {
    // If it's active, remove just this specific heatmap
    removeHeatmap(table, type === 'table' ? -1 : index, type);
  } else {
    // If not active, apply the new heatmap
    if (type === 'table') {
      applyTableHeatmap(table, options);
    } else {
      // For row/column, apply the new heatmap
      applyHeatmap(table, index, type, options);
    }
  }
}
