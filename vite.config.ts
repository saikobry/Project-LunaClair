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
        // Precache the app shell AND the bundled study content
        // (`public/materials/**` is copied verbatim into `dist/`). The SW then
        // answers `LocalDocumentRepository` fetches from cache — documents and
        // figure images work offline with zero repository changes.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,md,webmanifest,woff2}'],
        // SPA: deep links (pushState routes) fall back to the shell offline.
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
