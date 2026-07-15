import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { unplugin } from '@stylexjs/unplugin'
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
  plugins: [imageBase64(), unplugin.vite(), react(), fixStylexWindows()],
})

