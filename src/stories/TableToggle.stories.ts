import type { Meta, StoryObj } from '@storybook/html'
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
  play: async () => {
    // This function runs after the story is rendered.
    // We call our main initialization function here to apply the logic.
    initializeGridSight()
  },
}
