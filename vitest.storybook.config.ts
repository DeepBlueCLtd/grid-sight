import { defineConfig } from 'vitest/config'
import { mergeConfig } from 'vite'
import { vitestConfig } from '@storybook/addon-vitest'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    ...vitestConfig(),
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./vitest.setup.ts'],
      include: ['src/**/*.stories.@(js|jsx|ts|tsx)'],
      browser: {
        enabled: true,
        name: 'chromium',
        provider: 'playwright',
        headless: true,
      },
    },
  })
)
