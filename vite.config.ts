import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 80,
    proxy: {
      '/api': {
        target: 'http://192.168.219.108:8000',
        changeOrigin: true,
        secure: false, // If http, this doesn't matter much, but good habit
      }
    }
  }
})
