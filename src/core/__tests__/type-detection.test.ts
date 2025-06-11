import { describe, it, expect } from 'vitest';
import {
  isNumericColumn,
  isCategoricalColumn,
  detectColumnTypes,
  analyzeTable,
  extractTableData,
} from '../type-detection';
import type { 
  ColumnType,
  TypeDetectionOptions 
} from '../type-detection';

describe('Type Detection', () => {
  describe('isNumericColumn', () => {
    it('should identify numeric columns with plain numbers', () => {
      const values = [
        'Price',
        '100',
        '200',
        '300',
      ];
      
      expect(isNumericColumn(values)).toBe(true);
    });

    it('should identify numeric columns with currency symbols', () => {
      const values = [
        'Price',
        '$100',
        '€200.50',
        '£300.75',
      ];
      
      expect(isNumericColumn(values)).toBe(true);
    });

    it('should identify numeric columns with commas and periods', () => {
      const values = [
        'Price',
        '1,000.50',
        '2,000.75',
        '3,000.25',
      ];
      
      expect(isNumericColumn(values)).toBe(true);
    });

    it('should return false for non-numeric columns', () => {
      const values = [
        'Name',
        'Alice',
        'Bob',
        'Charlie',
      ];
      
      expect(isNumericColumn(values)).toBe(false);
    });

    it('should handle empty cells', () => {
      const values = [
        'Value',
        '',
        '100',
        '',
        '200',
      ];
      
      // With default threshold of 0.8, we need at least 3/4 non-empty cells to be numeric
      expect(isNumericColumn(values)).toBe(false);
      
      // With lower threshold, it should pass
      expect(isNumericColumn(values, { numericThreshold: 0.5 })).toBe(true);
    });

    it('should work without header row when hasHeader is false', () => {
      const values = [
        '100',
        '200',
        '300',
      ];
      
      expect(isNumericColumn(values, { hasHeader: false })).toBe(true);
    });
  });

  describe('isCategoricalColumn', () => {
    it('should identify categorical columns with enough unique values', () => {
      const values = [
        'Category',
        'A',
        'B',
        'C',
        'A',
      ];
      
      expect(isCategoricalColumn(values)).toBe(true);
    });

    it('should be case-insensitive for categorical values', () => {
      const values = [
        'Status',
        'active',
        'ACTIVE',
        'inactive',
        'INACTIVE',
      ];
      
      // Only 2 unique values when case is ignored
      expect(isCategoricalColumn(values, { minUniqueValuesForCategorical: 3 })).toBe(false);
      expect(isCategoricalColumn(values, { minUniqueValuesForCategorical: 2 })).toBe(true);
    });

    it('should return false for columns with too few unique values', () => {
      const values = [
        'Flag',
        'Yes',
        'No',
        'Yes',
        'No',
      ];
      
      // Only 2 unique values, which is below the default threshold of 3
      expect(isCategoricalColumn(values)).toBe(false);
      
      // Should pass with lower threshold
      expect(isCategoricalColumn(values, { minUniqueValuesForCategorical: 2 })).toBe(true);
    });

    it('should ignore empty cells', () => {
      const values = [
        'Value',
        '',
        'A',
        'B',
        'C',
      ];
      
      // 3 unique non-empty values
      expect(isCategoricalColumn(values, { minUniqueValuesForCategorical: 3 })).toBe(true);
    });

    it('should work without header row when hasHeader is false', () => {
      const values = [
        'A',
        'B',
        'C',
        'A',
      ];
      
      expect(isCategoricalColumn(values, { 
        hasHeader: false, 
        minUniqueValuesForCategorical: 2 
      })).toBe(true);
    });
  });

  describe('detectColumnTypes', () => {
    it('should detect column types correctly', () => {
      const rows = [
        ['Name', 'Age', 'Score', 'Active'],
        ['Alice', '30', '95.5', 'Yes'],
        ['Bob', '25', '88.0', 'No'],
        ['Charlie', '35', '92.3', 'Yes'],
      ];
      
      const expected: ColumnType[] = ['categorical', 'numeric', 'numeric', 'categorical'];
      expect(detectColumnTypes(rows)).toEqual(expected);
    });

    it('should handle mixed content columns', () => {
      const rows = [
        ['ID', 'Value'],
        ['1', '100'],
        ['2', 'Not a number'],
        ['3', '200'],
      ];
      
      // Value column is not numeric because not enough values are numbers
      expect(detectColumnTypes(rows)).toEqual(['categorical', 'unknown']);
      
      // With lower threshold, it might be considered numeric
      expect(detectColumnTypes(rows, { numericThreshold: 0.5 })).toEqual(['categorical', 'numeric']);
    });

    it('should handle tables without headers', () => {
      const rows = [
        ['Alice', '30', '95.5'],
        ['Bob', '25', '88.0'],
        ['Charlie', '35', '92.3'],
      ];
      
      const options: TypeDetectionOptions = { hasHeader: false };
      expect(detectColumnTypes(rows, options)).toEqual(['categorical', 'numeric', 'numeric']);
    });
  });

  describe('analyzeTable', () => {
    it('should mark table as suitable with multiple numeric/categorical columns', () => {
      const rows = [
        ['Name', 'Age', 'Score', 'Active'],
        ['Alice', '30', '95.5', 'Yes'],
        ['Bob', '25', '88.0', 'No'],
      ];
      
      const result = analyzeTable(rows);
      expect(result.isSuitable).toBe(true);
      expect(result.columnTypes).toEqual(['categorical', 'numeric', 'numeric', 'categorical']);
    });

    it('should mark table as not suitable with only one numeric/categorical column', () => {
      const rows = [
        ['ID', 'Name', 'Description'],
        ['1', 'Alice', 'First user'],
        ['2', 'Bob', 'Second user'],
      ];
      
      const result = analyzeTable(rows);
      expect(result.isSuitable).toBe(false);
      expect(result.columnTypes).toEqual(['numeric', 'categorical', 'unknown']);
    });
  });

  describe('extractTableData', () => {
    it('should extract table data into a 2D string array', () => {
      // Create a test table
      const table = document.createElement('table');
      
      const headerRow = table.insertRow();
      headerRow.insertCell().textContent = 'Name';
      headerRow.insertCell().textContent = 'Age';
      
      const dataRow1 = table.insertRow();
      dataRow1.insertCell().textContent = 'Alice';
      dataRow1.insertCell().textContent = '30';
      
      const dataRow2 = table.insertRow();
      dataRow2.insertCell().textContent = 'Bob';
      dataRow2.insertCell().textContent = '25';
      
      const result = extractTableData(table);
      expect(result).toEqual([
        ['Name', 'Age'],
        ['Alice', '30'],
        ['Bob', '25']
      ]);
    });

    it('should handle empty cells', () => {
      const table = document.createElement('table');
      const row = table.insertRow();
      row.insertCell().textContent = 'A';
      row.insertCell(); // Empty cell
      row.insertCell().textContent = 'C';
      
      const result = extractTableData(table);
      expect(result).toEqual([['A', '', 'C']]);
    });
  });
});
