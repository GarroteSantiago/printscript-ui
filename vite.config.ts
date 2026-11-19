/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      'process.env.FRONTEND_URL': JSON.stringify(env.FRONTEND_URL),
      'process.env.BACKEND_URL': JSON.stringify(env.BACKEND_URL)
    },
    plugins: [react()],
    // En npm run dev, /api (HTTP y WebSocket) va al NGINX de compose
    server: {
      proxy: {
        '/api': {target: env.DEV_API_PROXY || 'http://localhost', changeOrigin: true, ws: true},
      },
    },
    test: {
      include: ['src/**/*.test.{ts,tsx}'],
      environment: 'node',
    },
  }
})
