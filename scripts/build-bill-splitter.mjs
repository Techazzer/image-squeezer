import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { header, footer } from './platform-pages.mjs'

export async function buildBillSplitter(root, dist) {
  const source = path.join(root, 'tools/bill-splitter'), target = path.join(dist, 'bill-splitter')
  await mkdir(target, { recursive: true })
  const files = ['split-core.js', 'split.js', 'split.css']
  const sources = new Map(await Promise.all(files.map(async file => [file, await readFile(path.join(source, file), 'utf8')])))
  const version = createHash('sha256').update([...sources.values()].join('\n')).digest('hex').slice(0, 12)
  const names = new Map(files.map(file => [file, file.replace(/\.(js|css)$/, `-${version}.$1`)]))
  const versioned = text => { for (const [from, to] of names) text = text.replaceAll(`./${from}`, `./${to}`); return text }
  for (const [file, text] of sources) await writeFile(path.join(target, names.get(file)), versioned(text))
  const html = versioned(await readFile(path.join(source, 'index.html'), 'utf8')).replace('<!--SITE_HEADER-->', header).replace('<!--SITE_FOOTER-->', footer)
  await writeFile(path.join(target, 'index.html'), html)
  return [...names.values()].map(file => `bill-splitter/${file}`)
}
