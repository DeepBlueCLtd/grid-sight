import { describe, it, expect, beforeEach } from 'vitest';
import { findSuitableTables, isTableSuitable } from '../table-detection';

describe('Table Detection', () => {
  
  // Helper to create a test table with the specified content
  const createTestTable = (rows: string[][], hasThead = true): HTMLTableElement => {
    const table = document.createElement('table');
    
    if (hasThead) {
      const thead = table.createTHead();
      const headerRow = thead.insertRow();
      if (rows.length > 0) {
        rows[0].forEach(cellText => {
          const th = document.createElement('th');
          th.textContent = cellText;
          headerRow.appendChild(th);
        });
      }
    }
    
    const tbody = table.createTBody();
    const startRow = hasThead ? 1 : 0;
    
    for (let i = startRow; i < rows.length; i++) {
      const row = tbody.insertRow();
      rows[i].forEach(cellText => {
        const cell = row.insertCell();
        cell.textContent = cellText;
      });
    }
    
    return table;
  };
  
  beforeEach(() => {
    // Clean up any existing tables
    document.body.innerHTML = '';
  });

  describe('isTableSuitable', () => {
    it('should return false for tables without thead and tbody', () => {
      const table = document.createElement('table');
      const row = table.insertRow();
      row.insertCell().textContent = 'Header';
      row.insertCell().textContent = 'Value';
      
      const result = isTableSuitable(table);
      expect(result.isSuitable).toBe(false);
      expect(result.reason).toContain('must have both <thead> and <tbody> elements');
    });

    it('should return false for tables with no data rows', () => {
      const table = createTestTable([
        ['Name', 'Age', 'Score']
      ]);
      
      const result = isTableSuitable(table);
      expect(result.isSuitable).toBe(false);
      expect(result.reason).toContain('must have at least one data row');
    });

    it('should return true for tables with at least one suitable column', () => {
      const table = createTestTable([
        ['Name', 'Age', 'Department'],
        ['Alice', '30', 'Engineering'],
        ['Bob', '25', 'Marketing']
      ]);
      
      // 'Age' is numeric, so the table should be suitable
      const result = isTableSuitable(table);
      expect(result.isSuitable).toBe(true);
      expect(result.reason).toContain('meets all criteria');
    });

    it('should return true for tables with multiple suitable columns', () => {
      const table = createTestTable([
        ['Name', 'Age', 'Score', 'Active'],
        ['Alice', '30', '95.5', 'Yes'],
        ['Bob', '25', '88.0', 'No']
      ]);
      
      const result = isTableSuitable(table);
      expect(result.isSuitable).toBe(true);
      expect(result.reason).toContain('meets all criteria');
    });
  });

  describe('findSuitableTables', () => {
    it('should find and analyze all tables in the document', () => {
      // Create a test container
      const container = document.createElement('div');
      document.body.appendChild(container);
      
      // Add a suitable table
      const table1 = createTestTable([
        ['Name', 'Age', 'Score'],
        ['Alice', '30', '95.5'],
        ['Bob', '25', '88.0'],
        ['Charlie', '15', '38.0']
      ]);
      container.appendChild(table1);
      
      // Add an unsuitable table (only one suitable column)
      const table2 = createTestTable([
        ['Name', 'Department'],
        ['Alice', 'Engineering'],
        ['Bob', 'Marketing']
      ]);
      container.appendChild(table2);
      
      // Add another suitable table
      const table3 = createTestTable([
        ['City', 'Population', 'Area'],
        ['Tokyo', '13960000', '2191'],
        ['New York', '8419000', '783.8'],
        ['London', '8900000', '1572']
      ]);
      container.appendChild(table3);
      
      const results = findSuitableTables();
      
      // Should find 3 tables total
      expect(results.length).toBe(3);
      
      // First table should be suitable
      expect(results[0].isSuitable).toBe(true);
      expect(results[0].columnTypes).toEqual(['categorical', 'numeric', 'numeric']);
      
      // Second table should not be suitable
      expect(results[1].isSuitable).toBe(false);
      
      // Third table should be suitable
      expect(results[2].isSuitable).toBe(true);
      expect(results[2].columnTypes).toEqual(['categorical', 'numeric', 'numeric']);
    });
  });
});
