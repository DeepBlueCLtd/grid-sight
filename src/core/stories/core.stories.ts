import { processTable } from '../tableDetection'

export default {
  title: 'Core/Basic',
}

/**
 * Basic story that demonstrates the core Grid-Sight functionality.
 * Creates a simple table and applies Grid-Sight to add the enrichment toggle.
 */
export const BasicTable = () => {
  // Create a container
  const container = document.createElement('div')
  container.style.padding = '20px'
  
  // Create a table with header and body
  const table = document.createElement('table')
  table.style.borderCollapse = 'collapse'
  table.style.width = '100%'
  
  // Create header
  const thead = document.createElement('thead')
  const headerRow = document.createElement('tr')
  
  // Add header cells
  const headers = ['ID', 'Name', 'Value', 'Status']
  headers.forEach(headerText => {
    const th = document.createElement('th')
    th.textContent = headerText
    th.style.border = '1px solid #ccc'
    th.style.padding = '8px'
    th.style.backgroundColor = '#f2f2f2'
    headerRow.appendChild(th)
  })
  
  thead.appendChild(headerRow)
  table.appendChild(thead)
  
  // Create table body
  const tbody = document.createElement('tbody')
  
  // Sample data
  const data = [
    [1, 'Alpha', 42, 'Active'],
    [2, 'Beta', 18, 'Inactive'],
    [3, 'Gamma', 73, 'Active'],
    [4, 'Delta', 31, 'Pending'],
    [5, 'Epsilon', 50, 'Active']
  ]
  
  // Add rows
  data.forEach(rowData => {
    const row = document.createElement('tr')
    
    rowData.forEach(cellData => {
      const td = document.createElement('td')
      td.textContent = String(cellData)
      td.style.border = '1px solid #ccc'
      td.style.padding = '8px'
      row.appendChild(td)
    })
    
    tbody.appendChild(row)
  })
  
  table.appendChild(tbody)
  container.appendChild(table)
  
  // Process the table with Grid-Sight
  processTable(table)
  
  return container
}
