import type { Meta, StoryObj } from '@storybook/html-vite'
import { processTable } from '../core/tableDetection'

// Import HTML content as strings using Vite's ?raw import
import defaultTableHtml from './tables/default-table.html?raw'
import salesTableHtml from './tables/sales-data.html?raw'
import employeeTableHtml from './tables/employee-data.html?raw'
import twoDimTableHtml from './tables/two-dim-data.html?raw'

// Helper to track processed tables to prevent duplicate processing
const processedTables = new WeakSet<HTMLTableElement>()

// Helper to create a story with a table and process it
const createTableStory = (tableHtmlContent: string) => {
  // This is a function that Storybook will call to render the story
  return (): HTMLElement => {
    const container = document.createElement('div')
    container.style.padding = '20px'
    container.innerHTML = tableHtmlContent

    // Process the table after it's added to the DOM and rendered
    setTimeout(() => {
      const table = container.querySelector('table')
      if (table && !processedTables.has(table as HTMLTableElement)) {
        processedTables.add(table as HTMLTableElement)
        processTable(table as HTMLTableElement)
      }
    }, 0) // A small delay ensures the table is in the DOM

    return container
  }
}

const meta: Meta = {
  title: 'Example/Table (HTML Files)',
  tags: ['autodocs'],
  render: createTableStory(defaultTableHtml),
  parameters: {
    // Add a delay for Chromatic to ensure table processing completes
    chromatic: { delay: 100 },
  },
} as const

export default meta
type Story = StoryObj<typeof meta>

// Story for Sales Data table
export const SalesData: Story = {
  render: createTableStory(salesTableHtml),
}

// Story for Employee Data table
export const EmployeeData: Story = {
  render: createTableStory(employeeTableHtml),
}

// Story for Two Dimensional Data table
export const TwoDimensionalData: Story = {
  render: createTableStory(twoDimTableHtml),
}
