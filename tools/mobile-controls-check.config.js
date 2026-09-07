import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  root: repo,
  plugins: [react()],
  publicDir: false,
  preview: { host: '127.0.0.1', port: 5178, strictPort: true },
  build: {
    outDir: path.resolve(repo, '../mobile-controls-check'),
    emptyOutDir: false,
    target: 'esnext',
    rollupOptions: { input: path.join(repo, 'tools/mobile-controls-check.html') },
  },
});
