import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Configure how Vite handles different file types
  assetsInclude: ['**/*.html'],
  
  // Configure the development server
  server: {
    port: 6006, // Default Storybook port
    open: true,
  },
  
  // Configure build options
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  
  // Configure how modules are resolved
  resolve: {
    alias: {
      // Add any path aliases here if needed
    },
  },
  
  // Configure plugins
  plugins: [
    // Add any Vite plugins here
  ],
});
