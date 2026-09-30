import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs, so the build works from any sub-path on GitHub Pages
  // (it's published under /preview/ next to the dev site).
  base: './',
  build: {
    // One HTML entry per page: the landing page at the root, the media page
    // at media/ (a real folder, so refreshing it works on GitHub Pages).
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        media: fileURLToPath(new URL('./media/index.html', import.meta.url)),
      },
    },
  },
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
