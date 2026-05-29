import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Any request starting with /api goes to Django on port 8000
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})