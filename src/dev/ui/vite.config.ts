import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../../../dist/dev/ui',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:4567',
    },
  },
});
