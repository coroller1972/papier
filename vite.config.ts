import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    // Installable and fully usable offline: the whole build (fonts, Mermaid chunks) is precached.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Papier — Markdown vers PDF',
        short_name: 'Papier',
        description: 'Papier transforme vos fichiers Markdown et diagrammes Mermaid en PDF, localement dans le navigateur.',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f4f6f8',
        theme_color: '#f4f6f8',
        icons: [
          { src: '/papier-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/papier-icon.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        globIgnores: ['licenses/**'],
        maximumFileSizeToCacheInBytes: 3_000_000,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
