import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', '.git/**', 'coverage/**', 'tests/e2e/**'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '**/*.stories.ts',
        '**/__tests__/**',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
