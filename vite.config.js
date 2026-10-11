import { defineConfig } from 'vite';

export default defineConfig({
  // Use relative base path so assets load properly under GitHub Pages subdirectories
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
