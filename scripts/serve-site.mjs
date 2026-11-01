import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, stat } from 'node:fs/promises'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const port = Number(process.env.PORT || 4173)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('PORT must be an integer between 1024 and 65535')
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.webmanifest':'application/manifest+json', '.svg':'image/svg+xml', '.png':'image/png', '.xml':'application/xml', '.txt':'text/plain; charset=utf-8' }
const server = http.createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    if (pathname === '/__mobile-preview/') {
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}).end(`<!doctype html><html><head><title>Aeroniqx mobile preview</title><style>body{margin:0;background:#e8eef7;font:14px system-ui;color:#254064}header{padding:12px 24px}main{display:flex;gap:24px;justify-content:center}iframe{width:390px;height:calc(100vh - 65px);border:1px solid #c4d0e0;border-radius:22px;background:#fff;box-shadow:0 8px 26px #23405d18}p{margin:0}</style></head><body><header><strong>Aeroniqx · Mobile app preview</strong> — 390px phone layouts</header><main><iframe title="Mobile homepage" src="/"></iframe><iframe title="Mobile timesheet" src="/work-hours-calculator/"></iframe></main></body></html>`)
      return
    }
    let file = path.resolve(root, `.${pathname}`)
    if (!file.startsWith(root) && file !== path.resolve(root)) { res.writeHead(403).end(); return }
    if ((await stat(file)).isDirectory()) {
      if (!pathname.endsWith('/')) { res.writeHead(301, { Location: `${pathname}/` }).end(); return }
      file = path.join(file, 'index.html')
    }
    const content = await readFile(file)
    const extension=path.extname(file)
    const type=extension==='.pdf'?'application/pdf':extension==='.xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':types[extension]||'application/octet-stream'
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', ...(pathname.startsWith('/downloads/business/')?{'Content-Disposition':'attachment','X-Robots-Tag':'noindex, nofollow'}:{}) }).end(content)
  } catch {
    res.writeHead(404, { 'Content-Type':'text/html; charset=utf-8' }).end(await readFile(path.join(root,'404.html')))
  }
})
server.listen(port, '127.0.0.1', () => console.log(`Aeroniqx preview: http://127.0.0.1:${port}`))
