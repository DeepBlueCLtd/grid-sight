import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Simple plugin to copy the demo folder from public to dist
function copyDemoFolder() {
  return {
    name: 'copy-demo-folder',
    writeBundle() {
      // This will be implemented in the build script
      console.log('Demo files will be copied in the build script');
    },
  };
}

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
      fileName: (format) => `index.${format === 'iife' ? 'min.js' : format + '.js'}`,
      formats: ['iife'], // Only build IIFE format
    },
    rollupOptions: {
      // Ensure we don't bundle dependencies that should be external
      external: [],
      output: {
        // Ensure the IIFE is properly scoped and exposed as window.gridSight
        globals: {
          gridSight: 'gridSight',
          // Add any other global dependencies here if needed
        },
        // Ensure file:// compatibility
        assetFileNames: '[name][extname]',
        entryFileNames: '[name].min.js',
        // Ensure the library is properly exposed as window.gridSight
        name: 'gridSight',
        format: 'iife',
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
    copyDemoFolder(),
    // Add any other Vite plugins here
  ],

  // Configure public directory for static assets
  publicDir: 'public',
  
  // Ensure file:// protocol works
  base: './',
});
