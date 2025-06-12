import { isCategoricalColumn } from '../core/type-detection';
import { analyzeFrequencies } from '../utils/frequency';

const FREQUENCY_CLASS = 'gs-frequency';

// Store frequency analysis info for each table
declare global {
  interface HTMLElement {
    _frequencyInfos?: {
      index: number;
      type: 'row' | 'column';
      element: HTMLElement;
    }[];
  }
}

/**
 * Applies frequency analysis to a table row or column
 * @param table - The table element to analyze
 * @param index - The index of the row or column
 * @param type - Whether to analyze a row or column
 * @returns The frequency analysis results
 */
export function applyFrequencyAnalysis(
  table: HTMLTableElement,
  index: number,
  type: 'row' | 'column' = 'column'
): Array<[string, number, number]> {
  // Get the cells to analyze
  const cells: HTMLTableCellElement[] = [];
  
  if (type === 'column') {
    // For columns, get all cells in the specified column index
    const rows = table.tBodies[0]?.rows || table.rows;
    for (let i = 0; i < rows.length; i++) {
      const cell = rows[i].cells[index];
      if (cell) cells.push(cell);
    }
  } else {
    // For rows, get all cells in the specified row
    const row = table.rows[index];
    if (row) {
      for (let i = 0; i < row.cells.length; i++) {
        cells.push(row.cells[i]);
      }
    }
  }
  
  // Extract cell values
  const values = cells.map(cell => cell.textContent || '');
  
  // Check if the column is categorical
  if (!isCategoricalColumn(values)) {
    throw new Error('Frequency analysis can only be applied to categorical data');
  }
  
  // Calculate frequencies
  const frequencies = analyzeFrequencies(values);
  
  // Store the frequency info for cleanup
  if (!table._frequencyInfos) {
    table._frequencyInfos = [];
  }
  
  // Mark the row/column as having frequency analysis
  const header = type === 'column' 
    ? table.rows[0]?.cells[index]
    : table.rows[index]?.cells[0];
    
  if (header) {
    header.classList.add(`${FREQUENCY_CLASS}-header`);
    
    table._frequencyInfos.push({
      index,
      type,
      element: header
    });
  }
  
  return frequencies;
}

/**
 * Removes frequency analysis from a table
 * @param table - The table element
 * @param index - The index of the row or column (optional)
 * @param type - Whether to remove from a row or column (optional)
 */
export function removeFrequencyAnalysis(
  table: HTMLTableElement,
  index?: number,
  type?: 'row' | 'column'
): void {
  if (!table._frequencyInfos || table._frequencyInfos.length === 0) {
    return;
  }
  
  if (index !== undefined && type) {
    // Remove specific frequency analysis
    const infoIndex = table._frequencyInfos.findIndex(
      info => info.index === index && info.type === type
    );
    
    if (infoIndex !== -1) {
      const info = table._frequencyInfos[infoIndex];
      info.element.classList.remove(`${FREQUENCY_CLASS}-header`);
      table._frequencyInfos.splice(infoIndex, 1);
      
      // Remove the array if it's empty
      if (table._frequencyInfos.length === 0) {
        delete table._frequencyInfos;
      }
    }
  } else {
    // Remove all frequency analyses
    table._frequencyInfos.forEach(info => {
      info.element.classList.remove(`${FREQUENCY_CLASS}-header`);
    });
    
    delete table._frequencyInfos;
  }
}

/**
 * Toggles frequency analysis on a table row or column
 * @param table - The table element
 * @param index - The index of the row or column
 * @param type - Whether to analyze a row or column
 * @returns The frequency analysis results if applied, or undefined if removed
 */
export function toggleFrequencyAnalysis(
  table: HTMLTableElement,
  index: number,
  type: 'row' | 'column' = 'column'
): Array<[string, number, number]> | undefined {
  // Check if frequency analysis is already active
  const isActive = table._frequencyInfos?.some(
    info => info.index === index && info.type === type
  );
  
  if (isActive) {
    removeFrequencyAnalysis(table, index, type);
    return undefined;
  } else {
    return applyFrequencyAnalysis(table, index, type);
  }
}

/**
 * Checks if frequency analysis is active for a specific row or column
 * @param table - The table element
 * @param index - The index of the row or column
 * @param type - Whether to check a row or column
 * @returns True if frequency analysis is active
 */
export function isFrequencyAnalysisActive(
  table: HTMLTableElement,
  index: number,
  type: 'row' | 'column'
): boolean {
  return !!table._frequencyInfos?.some(
    info => info.index === index && info.type === type
  );
}
