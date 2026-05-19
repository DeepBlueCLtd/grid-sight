import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Configure how Vite handles different file types
  assetsInclude: ['**/*.html'],
  
  // Configure the development server (optional, for demo serving)
  server: {
    port: 3000,
    open: '/index.html',
  },
  
  // Configure build options
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true, // Include source maps
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'gridSight',
      fileName: 'grid-sight',
      formats: ['iife'],
    },
    rollupOptions: {
      // Make sure to externalize deps that shouldn't be bundled
      external: [],
      output: {
        // Provide global variables to use in the UMD build
        // for externalized deps
        globals: {},
        // Set the global variable name for the IIFE build
        name: 'gridSight',
        // Ensure the global variable is properly set
        extend: true,
        // ⚠ FRAGILE: the intro/outro pair below only behaves correctly while
        // `src/index.ts` exports `default` and NOTHING ELSE. As soon as a
        // named top-level export is added there, rollup switches the IIFE
        // wrapper to `this.gridSight = this.gridSight || {}` and runs this
        // outro AFTER `src/index.ts`'s own `window.gridSight = GridSight`
        // assignment — clobbering the global with `undefined` (because the
        // local `var gridSight` from the intro is never assigned).
        //
        // If you add a named export to src/index.ts, you MUST either:
        //   (a) drop the named export (current strategy — see src/index.ts),
        //   (b) rework intro/outro so the outro reads the actual export
        //       (e.g. `window.gridSight = this.gridSight.default`), or
        //   (c) replace this whole intro/outro/extend block with a single
        //       `format: 'iife', name: 'gridSight'` and let the IIFE return
        //       value bind the global itself.
        // See specs/012-virtual-columns/research.md §R-13.
        intro: 'var gridSight;',
        outro: 'window.gridSight = gridSight;',
      },
    },
    // Ensure all assets are properly copied
    assetsInlineLimit: 0,
    // Minify the output
    minify: 'terser',
  },
  
  // Configure how modules are resolved
  resolve: {
    alias: {
      // Add any path aliases here if needed
    },
  },
  
  // Configure plugins
  plugins: [
    // Add any other Vite plugins here
  ],

  // Configure public directory for static assets
  publicDir: 'public',
  
  // Base public path. Honour an explicit VITE_BASE_PATH override so PR-preview
  // builds can land under `/grid-sight/pr-preview/<NUM>/` without breaking
  // asset resolution. Falls back to the production / dev defaults.
  base: process.env.VITE_BASE_PATH
    || (process.env.NODE_ENV === 'production' ? '/grid-sight/' : '/'),
});
