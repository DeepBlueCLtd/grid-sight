import { defineConfig, mergeConfig } from 'vitest/config'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import viteConfig from './vite.config'
import path from 'node:path'

export default mergeConfig(
  viteConfig,
  defineConfig({
    plugins: [
      storybookTest({
        configDir: path.join(process.cwd(), '.storybook'),
        storybookScript: 'yarn storybook --ci',
      }),
    ],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./vitest.setup.ts'],
      include: ['src/**/*.stories.@(js|jsx|ts|tsx)'],
      browser: {
        enabled: true,
        provider: 'playwright',
        headless: true,
        instances: [{ browser: 'chromium' }],
      },
    },
  })
)
