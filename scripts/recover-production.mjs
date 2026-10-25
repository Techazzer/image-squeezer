import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'

const root = path.resolve('legacy-site')
const origin = 'https://312c5019.image-resizer-66w.pages.dev'
const files = JSON.parse(await readFile('../production-file-manifest.json', 'utf8'))
if (files.length !== 104) throw new Error('Unexpected production inventory; inspect before proceeding.')
const results = []
let next = 0
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < files.length) {
    const file = files[next++]
    const destination = path.resolve(root, file)
    if (!destination.startsWith(root + path.sep)) throw new Error('Invalid asset path')
    const response = await fetch(`${origin}/${file}`, { signal: AbortSignal.timeout(30000) })
    if (!response.ok && !(file === '404.html' && response.status === 404)) throw new Error(`${file}: HTTP ${response.status}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (!bytes.length) throw new Error(`Empty asset: ${file}`)
    await mkdir(path.dirname(destination), { recursive: true })
    await writeFile(destination, bytes)
    results.push({ file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
  }
}))
await mkdir('deployment', { recursive: true })
await writeFile('deployment/production-baseline.json', JSON.stringify({
  origin, deploymentId: '312c5019-ce54-4b5d-a127-ce84018f3a5a',
  inventorySource: 'Cloudflare dashboard: Assets uploaded (104 files)',
  recoveredAt: new Date().toISOString(), files: results.sort((a, b) => a.file.localeCompare(b.file)),
}, null, 2) + '\n')
console.log(`Recovered ${results.length} production files; checksums saved in deployment/production-baseline.json.`)
