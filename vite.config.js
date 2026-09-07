import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true
  },
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei'],
    esbuildOptions: {
      target: 'esnext'
    }
  },
  build: {
    target: 'esnext',
    commonjsOptions: {
      transformMixedEsModules: true
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate Three.js and 3D libraries for better caching
          'three-vendor': [
            'three',
            '@react-three/fiber',
            '@react-three/drei'
          ],
          // React and core libraries
          'react-vendor': [
            'react',
            'react-dom',
            'zustand'
          ]
        }
      }
    },
    chunkSizeWarningLimit: 500, // Warn if chunk exceeds 500KB
    minify: 'terser', // Better minification
    terserOptions: {
      compress: {
        // Strip only chatty logs; keep console.error/console.warn for prod debugging.
        pure_funcs: ['console.log', 'console.debug', 'console.info'],
        drop_debugger: true
      }
    }
  }
})
