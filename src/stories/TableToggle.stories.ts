import type { Meta, StoryObj } from '@storybook/html'
import { within } from '@storybook/testing-library'
import { expect } from '@storybook/test'
import { initializeGridSight } from '../main'
import suitableTableHtml from './tables/suitable.html?raw'
import unsuitableTableHtml from './tables/unsuitable.html?raw'

// Define the metadata for the story
const meta: Meta = {
  title: 'Features/Table Toggle Injection',
  render: () => {
    const container = document.createElement('div')
    container.innerHTML = `
      <h2>Suitable Table (more than 1 row)</h2>
      <p>The "GS" toggle should appear in the top-left cell of this table.</p>
      ${suitableTableHtml}

      <h2 style="margin-top: 40px;">Unsuitable Table (only 1 row)</h2>
      <p>The "GS" toggle should NOT appear on this table.</p>
      ${unsuitableTableHtml}
    `
    return container
  },
}

export default meta

type Story = StoryObj

// Define the actual story
export const Default: Story = {
  name: 'Default Table Toggle Behavior',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Run the main logic to inject the toggles
    initializeGridSight()

    // Test the suitable table
    const suitableTable = document.getElementById('suitable-table') as HTMLTableElement
    const suitableTableCanvas = within(suitableTable)
    const toggleInSuitable = await suitableTableCanvas.findByText('GS')
    expect(toggleInSuitable).toBeInTheDocument()

    // Test the unsuitable table
    const unsuitableTable = document.getElementById('unsuitable-table') as HTMLTableElement
    const unsuitableTableCanvas = within(unsuitableTable)
    const toggleInUnsuitable = unsuitableTableCanvas.queryByText('GS')
    expect(toggleInUnsuitable).not.toBeInTheDocument()
  },
}
