import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { unplugin } from '@stylexjs/unplugin'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'fs'
import { extname } from 'path'

function imageBase64(): Plugin {
  const suffix = '?base64'
  return {
    name: 'image-base64',
    load(id) {
      if (!id.endsWith(suffix)) return null
      const filePath = id.slice(0, -suffix.length)
      const buf = readFileSync(filePath)
      const ext = extname(filePath).slice(1)
      const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
      return `export default "data:${mime};base64,${buf.toString('base64')}"`
    },
  }
}

function fixStylexWindows(): Plugin {
  return {
    name: 'fix-stylex-windows',
    transformIndexHtml(html) {
      return html
        .replace(/\\virtual:stylex\.css/g, '/virtual:stylex.css')
        .replace(/\\@id\\virtual:stylex:runtime/g, '/@id/virtual:stylex:runtime')
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api': {
        target: 'https://api.project-lunaclair.workers.dev',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    imageBase64(),
    unplugin.vite(),
    react(),
    fixStylexWindows(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Project LunaClair',
        short_name: 'LunaClair',
        description:
          'Your personal offline-first learning workspace — study notes, annotations, and practice quizzes.',
        lang: 'en',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        categories: ['education', 'productivity'],
        icons: [
          { src: '/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the app shell only (~1.5 MB). Study materials (documents and
        // figure images) live in Cloudflare D1 and are fetched on demand via the
        // Worker API, then cached by the service worker via runtimeCaching.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        // SPA: deep links (pushState routes) fall back to the shell offline.
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Cache material documents and figure images served from the Worker API
            urlPattern: ({ url }) => url.pathname.startsWith('/api/documents/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'lunaclair-materials-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
})
