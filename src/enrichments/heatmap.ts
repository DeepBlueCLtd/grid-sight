import { cleanNumericCell } from '../core/type-detection';

const HEATMAP_CLASS = 'gs-heatmap';
const HEATMAP_CELL_CLASS = 'gs-heatmap-cell';

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

export function applyHeatmap(
  table: HTMLTableElement,
  index: number,
  type: 'row' | 'column' = 'column',
  options: HeatmapOptions = {}
): void {
  // Skip if already has heatmap
  if (table.classList.contains(HEATMAP_CLASS)) {
    return;
  }

  const rows = Array.from(table.rows);
  const values: number[] = [];
  const cells: HTMLTableCellElement[] = [];

  if (type === 'column') {
    // Column heatmap - apply to all cells in the column
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.cells[index]) continue;
      
      const cell = row.cells[index];
      const value = cleanNumericCell(cell.textContent || '');
      
      if (value !== null) {
        values.push(value);
        cells.push(cell);
      }
    }
  } else {
    // Row heatmap - apply to all cells in the row (except the first cell if it's a header)
    const row = rows[index];
    if (row) {
      // Start from 1 to skip the row header if it exists
      const startIndex = row.parentElement?.tagName === 'THEAD' ? 0 : 1;
      
      for (let i = startIndex; i < row.cells.length; i++) {
        const cell = row.cells[i];
        const value = cleanNumericCell(cell.textContent || '');
        
        if (value !== null) {
          values.push(value);
          cells.push(cell);
        }
      }
    }
  }

  if (values.length === 0) {
    console.warn('No numeric values found for heatmap');
    return;
  }

  // Calculate min and max values if not provided
  const minValue = options.minValue ?? Math.min(...values);
  const maxValue = options.maxValue ?? Math.max(...values);
  const valueRange = maxValue - minValue;
  
  if (valueRange === 0) {
    console.warn('No variation in values for heatmap');
    return;
  }

  // Apply heatmap styles
  const style = document.createElement('style');
  style.textContent = `
    .${HEATMAP_CELL_CLASS} {
      transition: background-color 0.3s ease;
    }
    
    .${HEATMAP_CELL_CLASS}:hover {
      outline: 2px solid #1976d2;
      outline-offset: -1px;
      position: relative;
      z-index: 1;
    }
  `;
  document.head.appendChild(style);

  // Apply colors to cells
  cells.forEach((cell, index) => {
    const value = values[index];
    const normalizedValue = (value - minValue) / valueRange;
    const colorIndex = Math.min(
      HEATMAP_COLORS.length - 1,
      Math.floor(normalizedValue * HEATMAP_COLORS.length)
    );
    
    cell.classList.add(HEATMAP_CELL_CLASS);
    cell.style.backgroundColor = HEATMAP_COLORS[colorIndex];
    cell.style.transition = 'background-color 0.3s ease';
    
    // Add title with the original value for better UX
    cell.title = `Value: ${value}`;
  });

  table.classList.add(HEATMAP_CLASS);
  
  // Store reference to the style element for cleanup
  (table as any)._heatmapStyle = style;
}

export function removeHeatmap(table: HTMLTableElement): void {
  // Remove heatmap classes and styles
  table.classList.remove(HEATMAP_CLASS);
  
  // Remove cell styles
  const cells = table.querySelectorAll(`.${HEATMAP_CELL_CLASS}`);
  cells.forEach(cell => {
    const cellElement = cell as HTMLElement;
    cellElement.style.backgroundColor = '';
    cellElement.style.transition = '';
    cellElement.title = '';
    cellElement.classList.remove(HEATMAP_CELL_CLASS);
  });
  
  // Remove the style element if it exists
  if ((table as any)._heatmapStyle) {
    (table as any)._heatmapStyle.remove();
    delete (table as any)._heatmapStyle;
  }
}

export function toggleHeatmap(
  table: HTMLTableElement,
  index: number,
  type: 'row' | 'column' = 'column',
  options: HeatmapOptions = {}
): void {
  if (table.classList.contains(HEATMAP_CLASS)) {
    removeHeatmap(table);
  } else {
    applyHeatmap(table, index, type, options);
  }
}
