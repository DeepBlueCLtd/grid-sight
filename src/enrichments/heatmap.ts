import { cleanNumericCell } from '../core/type-detection';

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
type HeatmapInfo = {
  index: number;
  type: 'row' | 'column';
  styleElement?: HTMLStyleElement;
  cellClasses: string[];
  cellElements: HTMLElement[]; // Track cell elements for cleanup
};

declare global {
  interface HTMLElement {
    _heatmapInfos?: HeatmapInfo[];
  }
}

// Add CSS class for heatmap cells
const style = document.createElement('style');
style.textContent = `
  .gs-heatmap-cell {
    transition: background-color 0.2s ease;
    position: relative;
  }
  .gs-heatmap-cell:hover {
    outline: 2px solid #1976d2;
    outline-offset: -1px;
    z-index: 1;
  }
`;
// Only add the style once
if (!document.head.querySelector('style[data-heatmap-styles]')) {
  style.setAttribute('data-heatmap-styles', '');
  document.head.appendChild(style);
}

// Track active heatmaps by table and index
type HeatmapKey = `${string}-${number}-${'row' | 'column'}`;
const activeHeatmaps = new Set<HeatmapKey>();

function getHeatmapKey(table: HTMLTableElement, index: number, type: 'row' | 'column'): HeatmapKey {
  return `${table.id || table.dataset.gsId || 'table'}-${index}-${type}`;
}

export function isHeatmapActive(table: HTMLTableElement, index: number, type: 'row' | 'column'): boolean {
  const key = getHeatmapKey(table, index, type);
  return activeHeatmaps.has(key);
}

function setHeatmapActive(table: HTMLTableElement, index: number, type: 'row' | 'column', active: boolean): void {
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
  type: 'row' | 'column' = 'column',
  options: HeatmapOptions = {}
): void {
  if (isHeatmapActive(table, index, type)) {
    return;
  }
  
  const { minValue, maxValue, colorScale = HEATMAP_COLORS } = options;
  
  // Get all cells in the specified row or column
  const cells: HTMLTableCellElement[] = [];
  const values: number[] = [];
  
  if (type === 'column') {
    // For columns, get all cells in the specified column index (1-based for querySelector)
    const columnCells = table.querySelectorAll<HTMLTableCellElement>(
      `tbody td:nth-child(${index + 1})`
    );
    
    columnCells.forEach((cell, i) => {
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
  
  // Create a style element for this heatmap
  const styleId = `heatmap-style-${table.id || 'table'}-${index}-${type}`;
  let styleElement = document.getElementById(styleId) as HTMLStyleElement;
  
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    document.head.appendChild(styleElement);
  }
  
  // Generate CSS for this heatmap
  let css = '';
  
  if (range === 0) {
    // All values are the same, use the middle color
    const colorIndex = Math.floor(colorScale.length / 2);
    const selector = type === 'column' 
      ? `#${table.id || 'table'} tbody td:nth-child(${index + 1})`
      : `#${table.id || 'table'} tbody tr:nth-child(${index}) td`;
    
    css = `${selector} {
      background-color: ${colorScale[colorIndex]} !important;
    }`;
  } else {
    // Track cell classes and elements for cleanup
    const trackedCellClasses: string[] = [];
    const trackedCellElements: HTMLTableCellElement[] = [];
    const timestamp = Date.now();
  
    // Generate CSS for each cell with a unique class
    cells.forEach((cell, idx) => {
      const normalized = (values[idx] - min) / range;
      const colorIndex = Math.min(
        colorScale.length - 1,
        Math.max(0, Math.floor(normalized * colorScale.length))
      );
    
      // Generate a unique class for this cell
      const cellClass = `heatmap-cell-${idx}-${timestamp}`;
    
      // Add the class to the cell
      cell.classList.add(cellClass, 'gs-heatmap-cell');
    
      // Add CSS for this cell
      css += `#${table.id || 'table'}.gs-heatmap .${cellClass} {
        background-color: ${colorScale[colorIndex]} !important;
      }`;
    
      // Track the cell class and element for cleanup
      trackedCellClasses.push(cellClass);
      trackedCellElements.push(cell);
    });
  
    // Initialize _heatmapInfos if it doesn't exist
    if (!table._heatmapInfos) {
      table._heatmapInfos = [];
    }
  
    // Add the heatmap info to the table
    const heatmapInfo: HeatmapInfo = {
      index,
      type,
      styleElement,
      cellClasses: trackedCellClasses,
      cellElements: trackedCellElements
    };
    
    table._heatmapInfos.push(heatmapInfo);
    
    // Apply the styles
    styleElement.textContent = css;
    
    // Track the active heatmap
    setHeatmapActive(table, index, type, true);
    
    // Add the heatmap class to the table
    table.classList.add(HEATMAP_CLASS);
    
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
}

export function removeHeatmap(table: HTMLTableElement, index?: number, type?: 'row' | 'column'): void {
  if (!table._heatmapInfos || table._heatmapInfos.length === 0) {
    return;
  }
  
  if (index !== undefined && type) {
    // Remove specific heatmap
    const heatmapIndex = table._heatmapInfos.findIndex(
      h => h.index === index && h.type === type
    );
    
    if (heatmapIndex !== -1) {
      const heatmap = table._heatmapInfos[heatmapIndex];
      if (heatmap.styleElement) {
        heatmap.styleElement.remove();
      }
      
      // Remove cell classes and reset styles
      heatmap.cellElements.forEach(cell => {
        cell.classList.remove('gs-heatmap-cell');
        cell.style.removeProperty('background-color');
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
      if (heatmap.styleElement) {
        heatmap.styleElement.remove();
      }
      
      // Remove cell classes and reset styles
      heatmap.cellElements.forEach(cell => {
        cell.classList.remove('gs-heatmap-cell');
        cell.style.removeProperty('background-color');
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

export function toggleHeatmap(
  table: HTMLTableElement,
  index: number,
  type: 'row' | 'column' = 'column',
  options: HeatmapOptions = {}
): void {
  // Check if this specific heatmap is already active
  const isActive = isHeatmapActive(table, index, type);
  
  // If it's active, remove it
  if (isActive) {
    removeHeatmap(table, index, type);
    return;
  }
  
  // If not active, first remove any existing heatmaps of the same type
  if (table._heatmapInfos?.some(h => h.type === type)) {
    // Remove all heatmaps of the same type
    const toRemove = [...(table._heatmapInfos || [])].filter(h => h.type === type);
    toRemove.forEach(h => removeHeatmap(table, h.index, h.type));
  }
  
  // Apply the new heatmap
  applyHeatmap(table, index, type, options);
}
