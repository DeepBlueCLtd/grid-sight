/**
 * Jest setup file for Grid-Sight tests
 */

// Mock browser environment
Object.defineProperty(window, 'MutationObserver', {
  value: class {
    constructor(callback) {
      this.callback = callback
    }
    disconnect() {}
    observe() {}
  }
})

// Create a global helper to create test tables
global.createTestTable = (options = {}) => {
  const { 
    withThead = true, 
    withTbody = true,
    rows = 3,
    cols = 3,
    withNumericData = true
  } = options
  
  const table = document.createElement('table')
  
  if (withThead) {
    const thead = document.createElement('thead')
    const headerRow = document.createElement('tr')
    
    for (let i = 0; i < cols; i++) {
      const th = document.createElement('th')
      th.textContent = `Header ${i + 1}`
      headerRow.appendChild(th)
    }
    
    thead.appendChild(headerRow)
    table.appendChild(thead)
  }
  
  if (withTbody) {
    const tbody = document.createElement('tbody')
    
    for (let i = 0; i < rows; i++) {
      const row = document.createElement('tr')
      
      for (let j = 0; j < cols; j++) {
        const td = document.createElement('td')
        
        // First column as labels, others as numeric if requested
        if (j === 0) {
          td.textContent = `Row ${i + 1}`
        } else if (withNumericData) {
          // Generate random numbers between 50 and 200
          td.textContent = Math.floor(Math.random() * 150 + 50).toString()
        } else {
          td.textContent = `Cell ${i + 1},${j + 1}`
        }
        
        row.appendChild(td)
      }
      
      tbody.appendChild(row)
    }
    
    table.appendChild(tbody)
  }
  
  return table
}

// Helper to simulate click events
global.simulateClick = (element) => {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window
  })
  element.dispatchEvent(event)
}