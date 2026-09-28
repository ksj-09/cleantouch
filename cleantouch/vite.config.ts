import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  server: { port: 5180, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        app: resolve(import.meta.dirname, 'index.html'),
        studio: resolve(import.meta.dirname, 'studio.html'),
        partner: resolve(import.meta.dirname, 'partner.html'),
      },
    },
  },
});
