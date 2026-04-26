import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function staticSeoPagesPlugin() {
  return {
    name: 'static-seo-pages',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || req.method !== 'GET') {
          next()
          return
        }

        const requestUrl = new URL(req.url, 'http://localhost')
        const pathname = decodeURIComponent(requestUrl.pathname)

        if (pathname === '/' || pathname.startsWith('/@') || pathname.includes('.')) {
          next()
          return
        }

        const relativePath = pathname.replace(/^\//, '').replace(/\/$/, '')
        if (!relativePath) {
          next()
          return
        }

        const htmlPath = path.join(server.config.publicDir, relativePath, 'index.html')
        if (!fs.existsSync(htmlPath)) {
          next()
          return
        }

        const html = fs.readFileSync(htmlPath, 'utf8')
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(html)
      })
    },
  }
}

// Pre-clean dist skipping .well-known (immutable in some sandbox envs)
function preCleanDistPlugin() {
  return {
    name: 'pre-clean-dist',
    buildStart() {
      const distDir = path.resolve('dist')
      if (!fs.existsSync(distDir)) return
      for (const entry of fs.readdirSync(distDir)) {
        if (entry === '.well-known') continue
        fs.rmSync(path.join(distDir, entry), { recursive: true, force: true })
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), staticSeoPagesPlugin(), preCleanDistPlugin()],
  build: { emptyOutDir: false },
})
