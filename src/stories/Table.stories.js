import { processTable } from '../core/tableDetection'
import defaultTableHtml from './tables/default-table.html?raw'
import salesTableHtml from './tables/sales-data.html?raw'
import employeeTableHtml from './tables/employee-data.html?raw'
import twoDimTableHtml from './tables/two-dim-data.html?raw'

// Helper to create a story with a table and process it
const createTableStory = (tableHtmlContent) => {
  // This is a function that Storybook will call to render the story
  return () => {
    const container = document.createElement('div')
    container.style.padding = '20px'
    container.innerHTML = tableHtmlContent

    // Process the table after it's added to the DOM and rendered
    setTimeout(() => {
      const table = container.querySelector('table')
      if (table) {
        processTable(table) // processTable expects an HTMLTableElement
      }
    }, 0) // A small delay ensures the table is in the DOM

    return container
  }
}

export default {
  title: 'Example/Table (HTML Files)', // Updated title for clarity
  tags: ['autodocs'],
  render: createTableStory(defaultTableHtml),
  parameters: {
    // Add a delay for Chromatic to ensure table processing completes
    chromatic: { delay: 100 },
  },
}

// Story for Sales Data table
export const SalesData = {
  render: createTableStory(salesTableHtml),
}

// Story for Employee Data table
export const EmployeeData = {
  render: createTableStory(employeeTableHtml),
}

// Story for Two Dimensional Data table
export const TwoDimensionalData = {
  render: createTableStory(twoDimTableHtml),
}
