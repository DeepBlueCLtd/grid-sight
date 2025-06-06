import type { Preview } from '@storybook/html'

/**
 * Cleanup function to remove Grid-Sight elements between stories
 */
const cleanupGridSight = () => {
  // Remove any Grid-Sight elements that might have been added
  const toggles = document.querySelectorAll('.grid-sight-toggle')
  toggles.forEach(toggle => toggle.remove())
  
  const contextMenus = document.querySelectorAll('.grid-sight-context-menu')
  contextMenus.forEach(menu => menu.remove())
  
  const plusIcons = document.querySelectorAll('.grid-sight-plus-icon')
  plusIcons.forEach(icon => icon.remove())
}

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#333333' }
      ]
    },
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    }
  },
  decorators: [
    (story) => {
      // Clean up any existing Grid-Sight elements before rendering the story
      cleanupGridSight()
      
      // Render the story
      const rendered = story()
      
      return rendered
    }
  ]
}

export default preview
