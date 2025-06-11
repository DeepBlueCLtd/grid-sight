import type { Meta, StoryObj } from '@storybook/html'
import { initializeGridSight } from '../main'

// Define the metadata for the story
const meta: Meta = {
  title: 'Features/Table Toggle Injection',
  render: () => {
    const container = document.createElement('div')
    container.innerHTML = `
      <h2>Suitable Table (more than 1 row)</h2>
      <p>The "GS" toggle should appear in the top-left cell of this table.</p>
      <table id="suitable-table" border="1" style="width: 300px; margin-bottom: 20px;">
        <thead>
          <tr>
            <th>Header 1</th>
            <th>Header 2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Data 1.1</td>
            <td>Data 1.2</td>
          </tr>
          <tr>
            <td>Data 2.1</td>
            <td>Data 2.2</td>
          </tr>
        </tbody>
      </table>

      <h2>Unsuitable Table (only 1 row)</h2>
      <p>The "GS" toggle should NOT appear on this table.</p>
      <table id="unsuitable-table" border="1" style="width: 300px;">
        <thead>
          <tr>
            <th>Header A</th>
            <th>Header B</th>
          </tr>
        </thead>
      </table>
    `
    return container
  },
}

export default meta

type Story = StoryObj

// Define the actual story
export const Default: Story = {
  name: 'Default Table Toggle Behavior',
  play: async () => {
    // This function runs after the story is rendered.
    // We call our main initialization function here to apply the logic.
    initializeGridSight()
  },
}
