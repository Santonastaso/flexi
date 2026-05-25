import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(() => {
  return {
    plugins: [react()],
    base: '/', // Correct for custom domain deployment
    server: {
      // Ensure dev server works correctly
      port: 5173,
      host: true,
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: undefined,
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      }
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
      globals: false
    }
  }
})
