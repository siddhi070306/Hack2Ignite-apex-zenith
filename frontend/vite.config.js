import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    // Self-signed HTTPS for `vite dev` only — lets a phone on the same LAN grant mic
    // permission (getUserMedia requires a secure context) while testing against the
    // local backend. Never applies to `vite build`, which is what Vercel deploys.
    ...(command === 'serve' ? [basicSsl()] : []),
  ],
  server: command === 'serve' ? {
    https: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  } : undefined,
}))
