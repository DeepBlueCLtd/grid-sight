import type { Meta, StoryObj } from '@storybook/html-vite'
import { processTable } from '../core/tableDetection'

// Helper to create a story with a table
const createTableStory = (html: string) => () => {
  const div = document.createElement('div')
  div.style.padding = '20px'
  div.innerHTML = html
  
  // Process the table after it's added to the DOM
  setTimeout(() => {
    const table = div.querySelector('table')
    if (table) processTable(table as HTMLTableElement)
  }, 0)
  
  return div
}

const meta = {
  title: 'Example/Table',
  tags: ['autodocs'],
  render: createTableStory(`
    <table class="data-table">
      <tr>
        <th>Product</th>
        <th>Q1 Sales</th>
        <th>Q2 Sales</th>
        <th>Q3 Sales</th>
        <th>Q4 Sales</th>
      </tr>
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
    </table>
  `),
  parameters: {
    chromatic: { delay: 1000 },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const SalesData: Story = {}

export const EmployeeData: Story = {
  render: createTableStory(`
    <table class="data-table">
      <tr>
        <th>Name</th>
        <th>Department</th>
        <th>Age</th>
        <th>Salary</th>
        <th>Tenure (years)</th>
      </tr>
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
    </table>
  `),
  parameters: {
    chromatic: { delay: 1000 },
  },
}
