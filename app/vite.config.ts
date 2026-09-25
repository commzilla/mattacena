import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Mattacena · Gestione',
        short_name: 'Mattacena',
        description: 'Prenotazioni, sala e fidelity di Mattacena',
        lang: 'it',
        start_url: '/',
        display: 'standalone',
        background_color: '#171412',
        theme_color: '#171412',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // API responses are never cached by the service worker: data must always be live.
        runtimeCaching: [],
      },
    }),
  ],
})
