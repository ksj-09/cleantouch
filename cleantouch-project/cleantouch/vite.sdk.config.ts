import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/sdk/index.ts'),
      name: 'CleanTouchSDK',
      formats: ['es', 'iife'],
      fileName: (format) => format === 'iife' ? 'cleantouch.js' : 'cleantouch.es.js',
    },
    outDir: 'dist-sdk',
    emptyOutDir: true,
    minify: true,
    sourcemap: true,
  },
});
