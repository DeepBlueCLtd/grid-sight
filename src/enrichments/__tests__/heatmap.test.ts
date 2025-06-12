import { toggleHeatmap, removeHeatmap, applyHeatmap, isHeatmapActive } from '../heatmap';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Heatmap', () => {
  // Create a test table with numeric data
  const createTestTable = (): HTMLTableElement => {
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Product</th>
          <th>Q1</th>
          <th>Q2</th>
          <th>Q3</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Widget A</td>
          <td>10</td>
          <td>20</td>
          <td>30</td>
        </tr>
        <tr>
          <td>Widget B</td>
          <td>15</td>
          <td>25</td>
          <td>35</td>
        </tr>
      </tbody>
    `;
    document.body.appendChild(table);
    return table;
  };

  // Helper function to get a cell by test ID
  const getCell = (table: HTMLTableElement, row: number, col: number): HTMLElement => {
    // First try to find by test ID
    const cellByTestId = table.querySelector(`[data-testid="cell-${row}-${col}"]`) as HTMLElement;
    if (cellByTestId) return cellByTestId;
    
    // Fall back to row/column indices if test ID not found
    const rowEl = table.rows[row];
    if (!rowEl) throw new Error(`Row ${row} not found`);
    
    const cell = rowEl.cells[col];
    if (!cell) throw new Error(`Cell at row ${row}, col ${col} not found`);
    
    return cell as HTMLElement;
  };
  
  // We can use isHeatmapActive directly from the import

  afterEach(() => {
    // Clean up after each test
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    // Mock console.warn to track warnings
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('Column Heatmap', () => {
    it('should apply heatmap to a column', () => {
      // Arrange
      const table = createTestTable();
      const columnIndex = 1; // First data column
      
      // Act - apply heatmap to the first data column
      toggleHeatmap(table, columnIndex, 'column');
      
      // Assert
      // 1. Check if heatmap is active for this column
      // Check if heatmap is active for this column
      expect(isHeatmapActive(table, columnIndex, 'column')).toBe(true);
      
      // 2. Check if the table has the heatmap class
      expect(table.classList.contains('gs-heatmap')).toBe(true);
      
      // 3. Check if cells in the column have background colors
      // Note: Adjust indices based on actual table structure
      const firstDataCell = table.querySelector('tbody td') as HTMLElement;
      expect(firstDataCell).toBeTruthy();
      
      // Check that at least one cell has a background color
      const hasColoredCell = Array.from(table.querySelectorAll('td')).some(
        cell => (cell as HTMLElement).style.backgroundColor
      );
      expect(hasColoredCell).toBe(true);
      
      // Clean up
      removeHeatmap(table);
    });

    it('should remove heatmap when toggled off', () => {
      // Arrange
      const table = createTestTable();
      const columnIndex = 1;
      
      // Act - toggle heatmap on and off
      toggleHeatmap(table, columnIndex, 'column');
      // Apply heatmap and verify it's applied before toggling off
      toggleHeatmap(table, columnIndex, 'column');
      
      // Assert - check if heatmap is removed
      // The table should no longer have the heatmap class
      expect(table.classList.contains('gs-heatmap')).toBe(false);
      
      // Cells should no longer have background colors
      const hasColoredCell = Array.from(table.querySelectorAll('td')).some(
        cell => (cell as HTMLElement).style.backgroundColor
      );
      expect(hasColoredCell).toBe(false);
    });

    it('should remove heatmap when toggling off', () => {
      // Arrange
      const table = createTestTable();
      const columnIndex = 1;
      
      // Act - apply heatmap
      toggleHeatmap(table, columnIndex, 'column');
      
      // Get a reference to a cell that should be colored
      const cell = table.querySelector('td') as HTMLElement;
      expect(cell).toBeTruthy();
      const initialColor = cell.style.backgroundColor;
      expect(initialColor).toBeTruthy();
      
      // Toggle off
      toggleHeatmap(table, columnIndex, 'column');
      
      // Assert - cell should no longer have a background color
      expect(cell.style.backgroundColor).toBe('');
    });

    it('should handle overlapping row and column heatmaps with diagonal split', () => {
      const table = createTestTable();
      document.body.appendChild(table);

      // Apply column heatmap
      toggleHeatmap(table, 1, 'column');
      
      // Get the cell that will be split
      const cell = table.querySelector('tbody tr:nth-child(1) td:nth-child(1)') as HTMLElement;
      const initialColor = cell.style.backgroundColor;
      
      // Apply row heatmap that will overlap with the column
      toggleHeatmap(table, 0, 'row');
      
      // Should have the split class and custom properties
      expect(cell.classList.contains('gs-heatmap-split')).toBe(true);
      expect(cell.style.getPropertyValue('--split-color-1')).toBeTruthy();
      expect(cell.style.getPropertyValue('--split-color-2')).toBeTruthy();
      
      // Should not have a background color directly set
      expect(cell.style.backgroundColor).toBe('');
      
      // Remove the row heatmap
      removeHeatmap(table, 0, 'row');
      
      // Should remove the split and restore column heatmap
      expect(cell.classList.contains('gs-heatmap-split')).toBe(false);
      expect(cell.style.backgroundColor).toBe(initialColor);
      
      // Clean up
      removeHeatmap(table);
    });

    it('should handle removing heatmap with overlapping cells', () => {
      const table = createTestTable();
      document.body.appendChild(table);

      // Apply both row and column heatmaps
      toggleHeatmap(table, 1, 'column');
      toggleHeatmap(table, 0, 'row');
      
      // Get the cell at the intersection
      const cell = table.querySelector('tbody tr:nth-child(1) td:nth-child(2)') as HTMLElement;
      
      // Remove the column heatmap
      removeHeatmap(table, 1, 'column');
      
      // Should remove the split and restore row heatmap
      expect(cell.classList.contains('gs-heatmap-split')).toBe(false);
      expect(cell.style.getPropertyValue('--split-color-1')).toBe('');
      expect(cell.style.getPropertyValue('--split-color-2')).toBe('');
      expect(cell.style.backgroundColor).toBeTruthy();
      
      // Clean up
      removeHeatmap(table);
    });
  });

  describe('Row Heatmap', () => {
    it('should apply heatmap to a numeric row', () => {
      // Arrange
      const table = createTestTable();
      const rowIndex = 1; // First data row
      
      // Act - apply heatmap to the first data row
      toggleHeatmap(table, rowIndex, 'row');
      
      // Assert
      // 1. Check if the table has the heatmap class
      expect(table.classList.contains('gs-heatmap')).toBe(true);
      
      // 2. Check if cells in the row have background colors
      const row = table.rows[rowIndex];
      expect(row).toBeTruthy();
      
      // Skip the first cell (text label) and check the rest
      const hasColoredCell = Array.from(row.cells).slice(1).some(
        cell => (cell as HTMLElement).style.backgroundColor
      );
      expect(hasColoredCell).toBe(true);
      
      // Clean up
      removeHeatmap(table);
    });

    it('should skip non-numeric cells in row heatmap', () => {
      const table = createTestTable();
      // Add a non-numeric value to the row
      table.rows[1].cells[1].textContent = 'N/A';
      
      // Apply heatmap to the row
      toggleHeatmap(table, 1, 'row');
      
      // The non-numeric cell should not have heatmap styles
      const nonNumericCell = table.rows[1].cells[1];
      expect(nonNumericCell.classList.contains('gs-heatmap-cell')).toBe(false);
      expect(nonNumericCell.style.backgroundColor).toBeFalsy();
      
      // Clean up
      removeHeatmap(table);
    });
  });

  describe('Split Cell Cleanup', () => {
    it('should clean up split cell styles when removing heatmap', () => {
      const table = createTestTable();
      
      // Apply both row and column heatmaps to create a split cell
      applyHeatmap(table, 1, 'column');
      applyHeatmap(table, 1, 'row');
      
      // Get the cell at the intersection
      const cell = getCell(table, 1, 1);
      
      // Verify split cell styles are applied
      expect(cell.classList.contains('gs-heatmap-split')).toBe(true);
      expect(cell.style.getPropertyValue('--split-color-1')).toBeTruthy();
      expect(cell.style.getPropertyValue('--split-color-2')).toBeTruthy();
      
      // Remove one of the heatmaps
      removeHeatmap(table, 1, 'column');
      
      // Verify split cell styles are cleaned up
      expect(cell.classList.contains('gs-heatmap-split')).toBe(false);
      expect(cell.style.getPropertyValue('--split-color-1')).toBe('');
      expect(cell.style.getPropertyValue('--split-color-2')).toBe('');
      
      // The other heatmap should still be active
      expect(cell.classList.contains('gs-heatmap-cell')).toBe(true);
      expect(cell.style.backgroundColor).toBeTruthy();
      
      // Clean up
      removeHeatmap(table);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty tables', () => {
      const table = document.createElement('table');
      document.body.appendChild(table);
      
      // Should not throw errors
      expect(() => toggleHeatmap(table, 0, 'column')).not.toThrow();
      expect(() => toggleHeatmap(table, 0, 'row')).not.toThrow();
      
      // Clean up
      document.body.removeChild(table);
    });

    it('should handle removing heatmap from a table without heatmap', () => {
      const table = createTestTable();
      
      // Should not throw errors
      expect(() => removeHeatmap(table)).not.toThrow();
    });
  });
});
