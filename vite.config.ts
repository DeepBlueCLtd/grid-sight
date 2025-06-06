import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'GridSight',
      fileName: 'grid-sight'
    },
    outDir: 'dist',
    sourcemap: true,
    // Ensure external dependencies aren't bundled
    rollupOptions: {
      output: {
        globals: {
          uplot: 'uPlot',
          valtio: 'valtio'
        }
      }
    }
  },
  base: '/grid-sight/'
})