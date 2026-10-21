import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import ui from '@nuxt/ui/vite'

// https://vite.dev/config/
const env = loadEnv('development', process.cwd(), '')

export default defineConfig({
  plugins: [ui(), vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Spotify only accepts 127.0.0.1 redirects, and the login cookie only
    // works if the app is opened on that same address.
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: env.API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
