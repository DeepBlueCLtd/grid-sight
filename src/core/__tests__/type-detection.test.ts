import { describe, it, expect } from 'vitest';
import { 
  isNumericColumn, 
  isCategoricalColumn, 
  detectColumnTypes, 
  analyzeTable,
  type ColumnType 
} from '../type-detection';

// Helper function to create a test table from a 2D array
function createTestTable(rows: string[][], withHeader: boolean = true): HTMLTableElement {
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  
  rows.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    
    row.forEach((cellText) => {
      const cell = rowIndex === 0 && withHeader 
        ? document.createElement('th')
        : document.createElement('td');
      
      cell.textContent = cellText;
      tr.appendChild(cell);
    });
    
    tbody.appendChild(tr);
  });
  
  table.appendChild(tbody);
  return table;
}

describe('Type Detection', () => {
  describe('isNumericColumn', () => {
    it('should identify numeric columns with plain numbers', () => {
      const table = createTestTable([
        ['Price'],
        ['10'],
        ['20.5'],
        ['-15.75'],
        ['1,000.50']
      ]);
      
      const cells = Array.from(table.rows).map(row => row.cells[0]);
      expect(isNumericColumn(cells)).toBe(true);
    });

    it('should identify numeric columns with currency symbols', () => {
      const table = createTestTable([
        ['Price'],
        ['$10'],
        ['£20.50'],
        ['€-15.75'],
        ['¥1,000.50']
      ]);
      
      const cells = Array.from(table.rows).map(row => row.cells[0]);
      expect(isNumericColumn(cells)).toBe(true);
    });

    it('should not identify text columns as numeric', () => {
      const table = createTestTable([
        ['Product'],
        ['Laptop'],
        ['Phone'],
        ['Tablet']
      ]);
      
      const cells = Array.from(table.rows).map(row => row.cells[0]);
      expect(isNumericColumn(cells)).toBe(false);
    });

    it('should handle empty cells', () => {
      const table = createTestTable([
        ['Price'],
        [''],
        ['10'],
        [''],
        ['20.5']
      ]);
      
      const cells = Array.from(table.rows).map(row => row.cells[0]);
      expect(isNumericColumn(cells)).toBe(true);
    });
  });

  describe('isCategoricalColumn', () => {
    it('should identify categorical columns with enough unique values', () => {
      const table = createTestTable([
        ['Category'],
        ['Electronics'],
        ['Clothing'],
        ['Books'],
        ['Electronics']
      ]);
      
      const cells = Array.from(table.rows).map(row => row.cells[0]);
      expect(isCategoricalColumn(cells)).toBe(true);
    });

    it('should not identify columns with too few unique values as categorical', () => {
      const table = createTestTable([
        ['Status'],
        ['Active'],
        ['Inactive'],
        ['Active']
      ]);
      
      const cells = Array.from(table.rows).map(row => row.cells[0]);
      expect(isCategoricalColumn(cells, { minUniqueValuesForCategorical: 3 })).toBe(false);
    });

    it('should be case insensitive when counting unique values', () => {
      const table = createTestTable([
        ['Color'],
        ['Red'],
        ['red'],
        ['Blue'],
        ['GREEN'],
        ['green']
      ]);
      
      const cells = Array.from(table.rows).map(row => row.cells[0]);
      expect(isCategoricalColumn(cells, { minUniqueValuesForCategorical: 3 })).toBe(true);
    });
  });

  describe('detectColumnTypes', () => {
    it('should detect column types in a mixed table', () => {
      const table = createTestTable([
        ['Product', 'Price', 'Category', 'In Stock'],
        ['Laptop', '$999.99', 'Electronics', 'Yes'],
        ['Phone', '$699.99', 'Electronics', 'No'],
        ['Tablet', '$299.99', 'Electronics', 'Yes'],
      ]);
      
      const expected: ColumnType[] = ['unknown', 'numeric', 'categorical', 'unknown'];
      expect(detectColumnTypes(table)).toEqual(expected);
    });
  });

  describe('analyzeTable', () => {
    it('should mark table as suitable with multiple numeric/categorical columns', () => {
      const table = createTestTable([
        ['Product', 'Price', 'Category', 'Rating'],
        ['Laptop', '$999.99', 'Electronics', '4.5'],
        ['Phone', '$699.99', 'Electronics', '4.2'],
        ['Tablet', '$299.99', 'Electronics', '4.0'],
      ]);
      
      const result = analyzeTable(table);
      expect(result.isSuitable).toBe(true);
      expect(result.columnTypes).toContain('numeric');
      expect(result.columnTypes).toContain('categorical');
    });

    it('should mark table as unsuitable with only one numeric/categorical column', () => {
      const table = createTestTable([
        ['Product', 'Price'],
        ['Laptop', 'Electronics'],
        ['Phone', 'Electronics'],
        ['Tablet', 'Electronics'],
      ]);
      
      const result = analyzeTable(table);
      expect(result.isSuitable).toBe(false);
    });
  });
});
