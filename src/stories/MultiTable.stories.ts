import { StoryFn, Meta } from '@storybook/html'
import { processAllTables } from '../core/tableDetection'
import { cleanupToggles } from '../ui/tableToggle' // Adjusted path if tableToggle.tsx was moved/renamed to .ts

// Import HTML content as raw strings
import employeeTableHtml from './tables/employee-data.html?raw'
import salesTableHtml from './tables/sales-data.html?raw'
import invalidTableHtml from './tables/invalid-table-structure.html?raw'

export default {
  title: 'Grid-Sight/Multi-Table Detection',
  argTypes: {},
  parameters: {
    // Optional parameters
  },
} as Meta

const Template: StoryFn = () => {
  // Ensure a clean slate before rendering
  cleanupToggles()

  const wrapper = document.createElement('div')
  wrapper.innerHTML = `
    <h2>Employee Data Table (Should Get Toggle)</h2>
    ${employeeTableHtml}
    <hr />
    <h2>Invalid Structure Table (Should NOT Get Toggle)</h2>
    ${invalidTableHtml}
    <hr />
    <h2>Sales Data Table (Should Get Toggle)</h2>
    ${salesTableHtml}
  `

  // Use a short timeout to ensure DOM is updated before processing tables
  // Storybook's rendering lifecycle can sometimes require this for scripts
  // that expect elements to be fully in the DOM.
  setTimeout(() => {
    processAllTables(wrapper) // Process tables within the context of the wrapper
  }, 100)

  return wrapper
}

export const Default = Template.bind({})
Default.args = {}

