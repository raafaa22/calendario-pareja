import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Nuestro calendario',
        short_name: 'Calendario',
        description: 'Calendario compartido de pareja, sincronizado con Google Calendar',
        theme_color: '#0d1b24',
        background_color: '#0d1b24',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'es',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // El script de Google Identity no se puede cachear: debe venir siempre
        // de la red o el flujo de OAuth se rompe.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Los eventos se cachean para poder consultarlos sin conexion.
            // NetworkFirst: si hay red, dato fresco; si no, el ultimo conocido.
            urlPattern: /^https:\/\/www\.googleapis\.com\/calendar\/v3\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'gcal-api',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
              networkTimeoutSeconds: 8,
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
