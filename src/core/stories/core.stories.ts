import { processTable } from '../tableDetection'
import '../../core/events'

export default {
  title: 'Core/Basic',
  parameters: {
    layout: 'fullscreen',
  }
}

/**
 * Basic story that demonstrates the core Grid-Sight functionality.
 * Creates a simple table and applies Grid-Sight to add the enrichment toggle.
 */
export const BasicTable = () => {
  // Create a container with some padding and styling
  const container = document.createElement('div')
  container.style.padding = '20px'
  container.style.fontFamily = 'Arial, sans-serif'
  
  // Add a title
  const title = document.createElement('h2')
  title.textContent = 'Grid-Sight Basic Demo'
  title.style.marginBottom = '20px'
  container.appendChild(title)
  
  // Add instructions
  const instructions = document.createElement('p')
  instructions.innerHTML = 'This demo shows the core Grid-Sight functionality. <br>Look for the Grid-Sight toggle button that appears in the bottom-right corner.'
  instructions.style.marginBottom = '20px'
  container.appendChild(instructions)
  
  // Create a table with header and body
  const table = document.createElement('table')
  table.style.borderCollapse = 'collapse'
  table.style.width = '100%'
  table.style.marginBottom = '30px'
  
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
  
  // Sample data with numeric values for the Value column
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
    
    rowData.forEach((cellData, index) => {
      const td = document.createElement('td')
      td.textContent = String(cellData)
      td.style.border = '1px solid #ccc'
      td.style.padding = '8px'
      
      // Make the Value column numeric for heatmap demonstration
      if (index === 2) {
        td.setAttribute('data-type', 'numeric')
      }
      
      row.appendChild(td)
    })
    
    tbody.appendChild(row)
  })
  
  table.appendChild(tbody)
  container.appendChild(table)
  
  // Use setTimeout to process the table after it's been attached to the DOM
  // This ensures the table has an offsetParent and passes the visibility check
  setTimeout(() => {
    processTable(table)
  }, 0)
  
  // Add usage instructions
  const usageInstructions = document.createElement('div')
  usageInstructions.innerHTML = `
    <h3>How to use Grid-Sight:</h3>
    <ol>
      <li>Click the Grid-Sight toggle button in the bottom-right corner to activate enrichment mode</li>
      <li>Notice the plus icons that appear in table headers and rows</li>
      <li>Click a plus icon to open the context menu with enrichment options</li>
      <li>Select an enrichment option like "Apply Heatmap" to visualize the data</li>
    </ol>
  `
  container.appendChild(usageInstructions)
  
  return container
}
