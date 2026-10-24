import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, stat } from 'node:fs/promises'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.xml':'application/xml', '.txt':'text/plain; charset=utf-8' }
const server = http.createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    if (pathname === '/image-compressor') pathname = '/index.html'
    let file = path.resolve(root, `.${pathname}`)
    if (!file.startsWith(root) && file !== path.resolve(root)) { res.writeHead(403).end(); return }
    if ((await stat(file)).isDirectory()) {
      if (!pathname.endsWith('/')) { res.writeHead(301, { Location: `${pathname}/` }).end(); return }
      file = path.join(file, 'index.html')
    }
    const content = await readFile(file)
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(content)
  } catch {
    res.writeHead(404, { 'Content-Type':'text/html; charset=utf-8' }).end(await readFile(path.join(root,'404.html')))
  }
})
server.listen(4173, '127.0.0.1', () => console.log('Aeroniqx preview: http://127.0.0.1:4173'))
