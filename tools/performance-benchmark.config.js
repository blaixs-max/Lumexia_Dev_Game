import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = process.env.LUMEXIA_BASELINE === '1';
const source = baseline ? path.resolve(repo, '../performance-baseline/src') : path.join(repo, 'src');
export default defineConfig({ root: repo, plugins: [react()], publicDir: false,
  resolve: { dedupe: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei', 'zustand'], alias: { '@benchmark/scene': path.join(source, 'components/RaceScene.jsx'), '@benchmark/store': path.join(source, 'store.js'), '@benchmark/hud': path.join(source, 'components/RaceHUD.jsx') } },
  build: { outDir: path.resolve(repo, baseline ? '../performance-before' : '../performance-after'), emptyOutDir: false, rollupOptions: { input: path.join(repo, 'tools/performance-benchmark.html') }, target: 'esnext' },
});
