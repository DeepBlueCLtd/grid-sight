import type { StorybookConfig } from '@storybook/html-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  // Remove the staticDirs as we don't need it
  core: {
    disableTelemetry: true,
  },
  framework: {
    name: '@storybook/html-vite',
    options: {},
  },
}

export default config
