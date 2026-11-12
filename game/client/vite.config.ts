import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// In development the game server runs on :8787 and Vite proxies the API and the WebSocket to it.
export default defineConfig({
  base: './',
  plugins: [vue()],
  server: {
    port: 5180,
    host: true,
    proxy: {
      '/api': 'http://localhost:8787',
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
})
