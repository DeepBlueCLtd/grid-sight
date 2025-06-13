import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  applyFrequencyAnalysis,
  removeFrequencyAnalysis,
  toggleFrequencyAnalysis,
  isFrequencyAnalysisActive
} from '../../enrichments/frequency'

describe('Frequency Analysis', () => {
  let table: HTMLTableElement
  
  // Create a test table with categorical data
  beforeEach(() => {
    document.body.innerHTML = `
      <table id="test-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>A</td>
            <td>10</td>
          </tr>
          <tr>
            <td>B</td>
            <td>20</td>
          </tr>
          <tr>
            <td>A</td>
            <td>30</td>
          </tr>
          <tr>
            <td>C</td>
            <td>40</td>
          </tr>
          <tr>
            <td>B</td>
            <td>50</td>
          </tr>
        </tbody>
      </table>
    `
    
    table = document.getElementById('test-table') as HTMLTableElement
  })
  
  afterEach(() => {
    document.body.innerHTML = ''
  })
  
  describe('applyFrequencyAnalysis', () => {
    it('calculates frequencies for a categorical column', () => {
      // Column 0 is the categorical column (Category)
      const result = applyFrequencyAnalysis(table, 0, 'column')
      
      // Expected frequencies: A: 2, B: 2, C: 1
      expect(result).toEqual([
        ['a', 2, 40],
        ['b', 2, 40],
        ['c', 1, 20]
      ])
      
      // Check that the header is marked
      const header = table.rows[0].cells[0]
      expect(header.classList.contains('gs-frequency-header')).toBe(true)
    })
    
    it('throws an error for non-categorical data', () => {
      // Column 1 is the numeric column (Value)
      expect(() => {
        applyFrequencyAnalysis(table, 1, 'column')
      }).toThrow('Frequency analysis can only be applied to categorical data')
    })
  })
  
  describe('removeFrequencyAnalysis', () => {
    it('removes frequency analysis from a column', () => {
      // Apply frequency analysis
      applyFrequencyAnalysis(table, 0, 'column')
      
      // Remove it
      removeFrequencyAnalysis(table, 0, 'column')
      
      // Check that the header class is removed
      const header = table.rows[0].cells[0]
      expect(header.classList.contains('gs-frequency-header')).toBe(false)
      
      // Check that the frequency info is removed
      expect(table._frequencyInfos).toBeUndefined()
    })
    
    it('removes all frequency analyses when no index/type is provided', () => {
      // Apply multiple frequency analyses
      applyFrequencyAnalysis(table, 0, 'column')
      
      // Add a test for row analysis if needed
      
      // Remove all
      removeFrequencyAnalysis(table)
      
      // Check that all headers are cleaned up
      const header = table.rows[0].cells[0]
      expect(header.classList.contains('gs-frequency-header')).toBe(false)
      expect(table._frequencyInfos).toBeUndefined()
    })
  })
  
  describe('toggleFrequencyAnalysis', () => {
    it('toggles frequency analysis on and off', () => {
      // First toggle - should apply
      const result1 = toggleFrequencyAnalysis(table, 0, 'column')
      expect(result1).toBeDefined()
      expect(isFrequencyAnalysisActive(table, 0, 'column')).toBe(true)
      
      // Second toggle - should remove
      const result2 = toggleFrequencyAnalysis(table, 0, 'column')
      expect(result2).toBeUndefined()
      expect(isFrequencyAnalysisActive(table, 0, 'column')).toBe(false)
    })
  })
  
  describe('isFrequencyAnalysisActive', () => {
    it('returns true when frequency analysis is active', () => {
      applyFrequencyAnalysis(table, 0, 'column')
      expect(isFrequencyAnalysisActive(table, 0, 'column')).toBe(true)
    })
    
    it('returns false when frequency analysis is not active', () => {
      expect(isFrequencyAnalysisActive(table, 0, 'column')).toBe(false)
    })
  })
})
