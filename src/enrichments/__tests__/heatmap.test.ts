import { toggleHeatmap, removeHeatmap } from '../heatmap';
import { describe, it, expect, afterEach } from 'vitest';

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

  afterEach(() => {
    // Clean up after each test
    document.body.innerHTML = '';
  });

  describe('Column Heatmap', () => {
    it('should apply heatmap to a numeric column', () => {
      const table = createTestTable();
      
      // Apply heatmap to first data column (Q1)
      toggleHeatmap(table, 1, 'column');
      
      // Check if heatmap is applied
      expect(table.classList.contains('gs-heatmap')).toBe(true);
      
      // Check if cells have heatmap class and styles
      const cells = table.querySelectorAll('td:nth-child(2)');
      expect(cells.length).toBe(2);
      expect(cells[0].classList.contains('gs-heatmap-cell')).toBe(true);
      expect(cells[0].style.backgroundColor).toBeTruthy();
      
      // Clean up
      removeHeatmap(table);
    });

    it('should remove heatmap when toggled off', () => {
      const table = createTestTable();
      
      // Toggle heatmap on and then off
      toggleHeatmap(table, 1, 'column');
      toggleHeatmap(table, 1, 'column');
      
      // Check if heatmap is removed
      expect(table.classList.contains('gs-heatmap')).toBe(false);
      expect(table.querySelectorAll('.gs-heatmap-cell').length).toBe(0);
    });
  });

  describe('Row Heatmap', () => {
    it('should apply heatmap to a numeric row', () => {
      const table = createTestTable();
      
      // Apply heatmap to first data row (index 1 since header is row 0)
      toggleHeatmap(table, 1, 'row');
      
      // Check if heatmap is applied
      expect(table.classList.contains('gs-heatmap')).toBe(true);
      
      // Check if cells have heatmap class and styles (skip first cell as it's the row header)
      const row = table.rows[1];
      for (let i = 1; i < row.cells.length; i++) {
        const cell = row.cells[i];
        expect(cell.classList.contains('gs-heatmap-cell')).toBe(true);
        expect(cell.style.backgroundColor).toBeTruthy();
      }
      
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

  describe('Edge Cases', () => {
    it('should handle empty tables', () => {
      const table = document.createElement('table');
      document.body.appendChild(table);
      
      // Should not throw errors
      expect(() => toggleHeatmap(table, 0, 'column')).not.toThrow();
      expect(() => toggleHeatmap(table, 0, 'row')).not.toThrow();
    });

    it('should handle removing heatmap from a table without heatmap', () => {
      const table = createTestTable();
      
      // Should not throw errors
      expect(() => removeHeatmap(table)).not.toThrow();
    });
  });
});
