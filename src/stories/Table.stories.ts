import type { Meta, StoryObj } from '@storybook/html-vite'
import { processTable } from '../core/tableDetection'

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Example/Table',
  tags: ['autodocs'],
  render: () => {
    // Create a container for our table
    const container = document.createElement('div')
    container.style.padding = '20px'
    
    // Create a sample data table
    const tableHtml = `
      <table id="sample-table" class="data-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Q1 Sales</th>
            <th>Q2 Sales</th>
            <th>Q3 Sales</th>
            <th>Q4 Sales</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Widget A</td>
            <td>1250</td>
            <td>1420</td>
            <td>1180</td>
            <td>1560</td>
          </tr>
          <tr>
            <td>Gadget B</td>
            <td>980</td>
            <td>1120</td>
            <td>1050</td>
            <td>1240</td>
          </tr>
          <tr>
            <td>Tool C</td>
            <td>1560</td>
            <td>1420</td>
            <td>1680</td>
            <td>1520</td>
          </tr>
          <tr>
            <td>Device D</td>
            <td>1120</td>
            <td>980</td>
            <td>1240</td>
            <td>1360</td>
          </tr>
        </tbody>
      </table>
    `
    
    container.innerHTML = tableHtml
    
    // Process the table after it's added to the DOM
    setTimeout(() => {
      const table = container.querySelector('table')
      if (table) {
        processTable(table as HTMLTableElement)
      }
    }, 0)
    
    return container
  },
  parameters: {
    // Add a delay to ensure the table is processed after the story is rendered
    chromatic: { delay: 1000 },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const SalesData: Story = {}

// Add a second story with a different table
export const EmployeeData: Story = {
  render: () => {
    const container = document.createElement('div')
    container.style.padding = '20px'
    
    const tableHtml = `
      <table id="employee-table" class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Department</th>
            <th>Age</th>
            <th>Salary</th>
            <th>Tenure (years)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>John Smith</td>
            <td>Engineering</td>
            <td>32</td>
            <td>85000</td>
            <td>4.5</td>
          </tr>
          <tr>
            <td>Jane Doe</td>
            <td>Marketing</td>
            <td>28</td>
            <td>72000</td>
            <td>2.5</td>
          </tr>
          <tr>
            <td>Mike Johnson</td>
            <td>Sales</td>
            <td>35</td>
            <td>92000</td>
            <td>6.0</td>
          </tr>
          <tr>
            <td>Sarah Williams</td>
            <td>Engineering</td>
            <td>41</td>
            <td>105000</td>
            <td>8.5</td>
          </tr>
        </tbody>
      </table>
    `
    
    container.innerHTML = tableHtml
    
    // Process the table after it's added to the DOM
    setTimeout(() => {
      const table = container.querySelector('table')
      if (table) {
        processTable(table as HTMLTableElement)
      }
    }, 0)
    
    return container
  },
  parameters: {
    chromatic: { delay: 1000 },
  },
}
