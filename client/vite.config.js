import { fileURLToPath, URL } from 'node:url'
import process from 'node:process'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import ui from '@nuxt/ui/vite'
import appConfig from './app.config.ts'

// https://vite.dev/config/
const env = loadEnv('development', process.cwd(), '')

export default defineConfig({
  plugins: [
    ui({
      // Nuxt UI's own colours plus the five music mood tags
      // (<UBadge color="sad">). Their shades are in assets/css/main.css.
      theme: {
        colors: [
          'primary',
          'secondary',
          'success',
          'info',
          'warning',
          'error',
          'sad',
          'happy',
          'relaxed',
          'anxious',
          'angry',
        ],
      },
      ui: {
        ...appConfig.ui,
        colors: {
          ...appConfig.ui.colors,
          sad: 'mood-sad',
          happy: 'mood-happy',
          relaxed: 'mood-relaxed',
          anxious: 'mood-anxious',
          angry: 'mood-angry',
        },
      },
    }),
    vue({ template: { transformAssetUrls: { includeAbsolute: false } } }),
    vueDevTools(),
  ],
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
