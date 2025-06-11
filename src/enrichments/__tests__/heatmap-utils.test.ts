import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getColorForValue, 
  normalizeValue, 
  calculateMinMax, 
  extractNumericValues 
} from '../heatmap-utils';

// Mock DOM elements for extractNumericValues tests
const createMockTable = (rows: string[][]) => {
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  
  rows.forEach(rowData => {
    const row = document.createElement('tr');
    rowData.forEach(cellText => {
      const cell = document.createElement('td');
      cell.textContent = cellText;
      row.appendChild(cell);
    });
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  return table;
};

describe('Heatmap Utils', () => {
  describe('normalizeValue', () => {
    it('should normalize a value within range', () => {
      expect(normalizeValue(5, 0, 10)).toBe(0.5);
      expect(normalizeValue(2, 0, 10)).toBe(0.2);
      expect(normalizeValue(8, 0, 10)).toBe(0.8);
    });

    it('should handle min and max values', () => {
      expect(normalizeValue(0, 0, 10)).toBe(0);
      expect(normalizeValue(10, 0, 10)).toBe(1);
    });

    it('should handle values outside range', () => {
      expect(normalizeValue(-5, 0, 10)).toBe(0);
      expect(normalizeValue(15, 0, 10)).toBe(1);
    });

    it('should handle zero range', () => {
      expect(normalizeValue(5, 5, 5)).toBe(0);
    });
  });

  describe('getColorForValue', () => {
    const colorScale = ['#000000', '#888888', '#FFFFFF'];
    
    it('should return first color for min value', () => {
      expect(getColorForValue(0, 0, 1, colorScale)).toBe(colorScale[0]);
    });

    it('should return last color for max value', () => {
      expect(getColorForValue(1, 0, 1, colorScale)).toBe(colorScale[2]);
    });

    it('should return middle color for middle value', () => {
      expect(getColorForValue(0.5, 0, 1, colorScale)).toBe(colorScale[1]);
    });

    it('should handle custom min/max values', () => {
      expect(getColorForValue(50, 0, 100, colorScale)).toBe(colorScale[1]);
    });

    it('should handle values outside range', () => {
      expect(getColorForValue(-10, 0, 10, colorScale)).toBe(colorScale[0]);
      expect(getColorForValue(20, 0, 10, colorScale)).toBe(colorScale[2]);
    });
  });

  describe('calculateMinMax', () => {
    it('should calculate min and max for numeric arrays', () => {
      const values = [1, 5, 3, 10, 2];
      const { min, max } = calculateMinMax(values);
      expect(min).toBe(1);
      expect(max).toBe(10);
    });

    it('should handle string numbers', () => {
      const values = ['1', '5', '3', '10', '2'];
      const { min, max } = calculateMinMax(values);
      expect(min).toBe(1);
      expect(max).toBe(10);
    });

    it('should ignore non-numeric values', () => {
      const values = [1, 'not a number', 5, '3', ''];
      const { min, max } = calculateMinMax(values);
      expect(min).toBe(1);
      expect(max).toBe(5);
    });
    
    it('should handle arrays with null or undefined', () => {
      const values = [1, 5, null as unknown as string, undefined as unknown as string];
      const { min, max } = calculateMinMax(values);
      expect(min).toBe(1);
      expect(max).toBe(5);
    });

    it('should return 0 for empty arrays', () => {
      const { min, max } = calculateMinMax([]);
      expect(min).toBe(0);
      expect(max).toBe(0);
    });

    it('should use provided min/max values', () => {
      const values = [1, 2, 3];
      const { min, max } = calculateMinMax(values, 0, 10);
      expect(min).toBe(0);
      expect(max).toBe(10);
    });
  });

  describe('extractNumericValues', () => {
    let table: HTMLTableElement;

    beforeEach(() => {
      table = createMockTable([
        ['Header', '1', '2.5', '3'],
        ['Row 1', '4', '5.5', '6'],
        ['Row 2', '7', 'not a number', '9']
      ]);
    });

    it('should extract numeric values from table cells', () => {
      const cells = Array.from(table.querySelectorAll('td'));
      const values = extractNumericValues(cells);
      expect(values).toEqual([1, 2.5, 3, 4, 5.5, 6, 7, 9]);
    });

    it('should skip header row when skipHeader is true', () => {
      const cells = Array.from(table.querySelectorAll('td'));
      const values = extractNumericValues(cells, { skipHeader: true });
      expect(values).toEqual([4, 5.5, 6, 7, 9]);
    });

    it('should handle empty cells', () => {
      const emptyCell = document.createElement('td');
      const values = extractNumericValues([emptyCell]);
      expect(values).toEqual([]);
    });
  });
});
