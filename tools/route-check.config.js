import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export default defineConfig({
  root: repo, plugins: [react()], publicDir: false,
  build: { outDir: path.resolve(repo, '../route-check'), emptyOutDir: false, target: 'esnext',
    rollupOptions: { input: path.join(repo, 'tools/route-check.html') } },
});
