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
    open: '/demo.html',
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
        // Use a self-executing function to ensure proper scoping
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
  
  // Base public path when served in production
  base: process.env.NODE_ENV === 'production' ? '/grid-sight/' : '/',
});
