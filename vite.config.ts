import { defineConfig } from 'vite'

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  server: {
    port: 3000
  },
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'GridSight',
      fileName: (format) => `grid-sight.${format}.js`,
      formats: ['es', 'umd']
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {}
      }
    }
  }
})
