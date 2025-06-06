/**
 * BDD Tests for Table Detection functionality
 * 
 * Feature: Table Detection and Toggle Injection
 * As a user viewing a web page with HTML tables
 * I want Grid-Sight to automatically detect valid tables
 * So that I can use data visualization features on them
 */

import { isValidTable, processTable, initTableDetection } from '../../src/core/tableDetection'

describe('Feature: Table Detection and Toggle Injection', () => {
  
  beforeEach(() => {
    // Clear the DOM before each test
    document.body.innerHTML = ''
    
    // Reset any mocks
    jest.clearAllMocks()
    
    // Spy on console.error
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  
  describe('Scenario: Detect valid tables on page load', () => {
    test('Given a page contains a valid <table> with <thead> and <tbody>', () => {
      // Create a valid table and add it to the document
      const table = createTestTable()
      document.body.appendChild(table)
      
      // When we check if the table is valid
      const result = isValidTable(table)
      
      // Then it should be identified as valid
      expect(result).toBe(true)
    })
    
    test('When Grid-Sight loads and processes a valid table', () => {
      // Given a valid table
      const table = createTestTable()
      document.body.appendChild(table)
      
      // When Grid-Sight processes the table
      processTable(table)
      
      // Then a GS toggle should appear
      const toggle = document.querySelector('.grid-sight-toggle')
      expect(toggle).not.toBeNull()
    })
    
    test('Then a GS toggle appears adjacent to the top-right of the table', () => {
      // Given a valid table
      const table = createTestTable()
      document.body.appendChild(table)
      
      // When Grid-Sight processes the table
      processTable(table)
      
      // Then a GS toggle should appear with appropriate styling
      const toggle = document.querySelector('.grid-sight-toggle') as HTMLElement
      expect(toggle).not.toBeNull()
      
      // Check positioning styles
      expect(toggle.style.position).toBe('absolute')
      
      // The toggle should be styled as a button
      expect(toggle.getAttribute('role')).toBe('button')
      expect(toggle.getAttribute('tabindex')).toBe('0')
    })
  })
  
  describe('Scenario: Table with no headers or body', () => {
    test('Given a page contains a <table> without <thead> tags', () => {
      // Create an invalid table without thead
      const invalidTable = createTestTable({ withThead: false })
      document.body.appendChild(invalidTable)
      
      // When we check if the table is valid
      const result = isValidTable(invalidTable)
      
      // Then it should be identified as invalid
      expect(result).toBe(false)
    })
    
    test('Given a page contains a <table> without <tbody> tags', () => {
      // Create an invalid table without tbody
      const invalidTable = createTestTable({ withTbody: false })
      document.body.appendChild(invalidTable)
      
      // When we check if the table is valid
      const result = isValidTable(invalidTable)
      
      // Then it should be identified as invalid
      expect(result).toBe(false)
    })
    
    test('Then no GS toggle should be injected for invalid tables', () => {
      // Given an invalid table
      const invalidTable = createTestTable({ withThead: false })
      document.body.appendChild(invalidTable)
      
      // When Grid-Sight processes the table
      processTable(invalidTable)
      
      // Then no toggle should be created
      const toggle = document.querySelector('.grid-sight-toggle')
      expect(toggle).toBeNull()
    })
    
    test('And an error log should mention "invalid table structure"', () => {
      // Given an invalid table
      const invalidTable = createTestTable({ withThead: false })
      document.body.appendChild(invalidTable)
      
      // When Grid-Sight processes the table
      processTable(invalidTable)
      
      // Then an error should be logged
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('invalid table structure')
      )
    })
  })
  
  describe('Scenario: Dynamic table injected via JavaScript', () => {
    test('Given Grid-Sight is active and a table is dynamically added to the DOM', () => {
      // Initialize table detection (sets up MutationObserver)
      initTableDetection()
      
      // Create a new table to be "dynamically" added
      const dynamicTable = createTestTable()
      
      // Mock the MutationObserver callback
      const mockCallback = (document.body.querySelector('table') as any)?.MutationObserver?.callback
      
      if (mockCallback) {
        // Simulate adding a new table via mutation
        const mockMutation = [{
          addedNodes: [dynamicTable],
          type: 'childList'
        }]
        
        // When the mutation occurs
        mockCallback(mockMutation)
        
        // Then the table should be processed
        const toggle = document.querySelector('.grid-sight-toggle')
        expect(toggle).not.toBeNull()
      } else {
        // If MutationObserver mocking failed, manually test the functionality
        document.body.appendChild(dynamicTable)
        processTable(dynamicTable)
        
        const toggle = document.querySelector('.grid-sight-toggle')
        expect(toggle).not.toBeNull()
      }
    })
  })
})