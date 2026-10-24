import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const baseline = path.join(root, 'legacy-site')
const dist = path.resolve(root, 'dist')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const manifest = JSON.parse(await readFile(path.join(root, 'deployment/production-baseline.json'), 'utf8'))
const shell = JSON.parse(await readFile(path.join(root, 'deployment/site-shell.json'), 'utf8'))

// Keep the recovered, complete deployment immutable. Stop on any unexpected edit.
for (const item of manifest.files) {
  if (hash(await readFile(path.join(baseline, item.file))) !== item.sha256) throw new Error(`Baseline changed: ${item.file}`)
}
if (dist !== path.join(root, 'dist') || path.dirname(dist) !== path.resolve(root)) throw new Error('Unsafe output directory')
await rm(dist, { recursive: true, force: true })
await cp(baseline, dist, { recursive: true })

function replaceOnce(source, from, to, label) {
  if (source.split(from).length !== 2) throw new Error(`Expected one ${label} integration point`)
  return source.replace(from, to)
}

// Only catalog and navigation data are patched; all existing tool implementations stay intact.
const originalBundle = 'assets/index-Do-dAaN2.js'
let bundle = await readFile(path.join(dist, originalBundle), 'utf8')
bundle = replaceOnce(bundle, '},{id:"finance",', '},{id:"work",label:"⏱️ Work & Productivity",desc:"Everyday tools for your workday. Free, private, and ready to use — no account needed.",tools:[{icon:"⏱️",title:"Work Hours & Timesheet",desc:"Track shifts, breaks, overtime and estimated pay. Export a CSV or print your weekly timesheet.",href:"/work-hours-calculator/",badge:"New",isExternal:!0}]},{id:"finance",', 'homepage category')
bundle = replaceOnce(bundle, '{heading:"Finance Calculators",tools:[', '{heading:"Work & Productivity",tools:[{label:"Work Hours & Timesheet",href:"/work-hours-calculator/",icon:"HRS",color:"#1a73e8"}]},{heading:"Finance Calculators",tools:[', 'All Tools menu')
bundle = replaceOnce(bundle, 'p.jsx("a",{href:"/compress-image-to-50kb/",className:"nav-link",children:"50KB Tool"})', 'p.jsx("a",{href:"/work-hours-calculator/",className:"nav-link",children:"Work Hours"})', 'header shortcut')
const bundleName = `assets/index-${hash(bundle).slice(0,12)}.js`
// The PDF export chunk imports shared utilities from the entry bundle. Point its
// copy back to this release so loading it cannot execute the old app a second time.
const pdfChunkOriginal = 'assets/index.es-BcQs88vO.js'
const pdfChunkName = `assets/index.es-${hash(bundle).slice(0,12)}.js`
const pdfChunk = (await readFile(path.join(baseline, pdfChunkOriginal), 'utf8'))
  .replaceAll(path.basename(originalBundle), path.basename(bundleName))
bundle = bundle.replaceAll(path.basename(pdfChunkOriginal), path.basename(pdfChunkName))
await writeFile(path.join(dist, pdfChunkName), pdfChunk)
await writeFile(path.join(dist, bundleName), bundle)
const updatesCss = '.ad-slot{display:none!important}\n'
await writeFile(path.join(dist, 'assets/aeroniqx-updates.css'), updatesCss)

for (const item of manifest.files.filter(item => item.file.endsWith('.html'))) {
  let html = await readFile(path.join(dist, item.file), 'utf8')
  html = html.replaceAll(originalBundle, bundleName)
    .replace(/<script\b[^>]*src=["']https:\/\/pagead2\.googlesyndication\.com\/[^"']*["'][^>]*>\s*<\/script>/gi, '')
    .replace(/<script\b[^>]*src=["']https:\/\/static\.cloudflareinsights\.com\/[^"']*["'][^>]*>\s*<\/script>/gi, '')
    .replace('</head>', '  <link rel="stylesheet" href="/assets/aeroniqx-updates.css">\n</head>')
  await writeFile(path.join(dist, item.file), html)
}

const toolDir = path.join(dist, 'work-hours-calculator')
await cp(path.join(root, 'tools/work-hours'), toolDir, { recursive: true })
let header = shell.header
  .replace(/<div class="nav-dropdown-trigger">.*?<\/div>/, '<a href="/#tools" class="nav-link">All Tools</a>')
  .replace('<a href="/compress-image-to-50kb/" class="nav-link">50KB Tool</a>', '<a href="/work-hours-calculator/" class="nav-link" aria-current="page">Work Hours</a>')
  .replace(/<button class="hamburger [^"]*"[^>]*>.*?<\/button>/, '<a href="/#tools" class="wh-mobile-tools">All tools</a>')
  .replaceAll(' data-discover="true"', '')
const footer = shell.footer.replaceAll('/privacy-policy-generator/', '/privacy/').replace('Free online image &amp; PDF tools', 'Free online image, PDF &amp; productivity tools')
const html = (await readFile(path.join(toolDir, 'index.html'), 'utf8')).replace('<!--SITE_HEADER-->', header).replace('<!--SITE_FOOTER-->', footer)
await writeFile(path.join(toolDir, 'index.html'), html)

const sitemap = await readFile(path.join(dist, 'sitemap.xml'), 'utf8')
await writeFile(path.join(dist, 'sitemap.xml'), sitemap.replace('</urlset>', '  <url><loc>https://aeroniqx.in/work-hours-calculator/</loc><lastmod>2026-10-24</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>\n</urlset>'))
const llms = await readFile(path.join(dist, 'llms.txt'), 'utf8')
await writeFile(path.join(dist, 'llms.txt'), `${llms}\n## Work & Productivity\n- [Work Hours & Timesheet Calculator](https://aeroniqx.in/work-hours-calculator/): Calculate shifts, unpaid breaks, overnight work, daily or weekly overtime and estimated pay. Free CSV, print, and local backup; no ads or login.\n`)
for (const file of ['_headers', '_redirects']) await cp(path.join(root, 'deployment', file), path.join(dist, file))
await mkdir(path.join(root, 'deployment'), { recursive: true })
await writeFile(path.join(root, 'deployment/build.json'), JSON.stringify({ baselineDeployment: manifest.deploymentId, baselineFiles: manifest.files.length, entryBundle: bundleName, pdfChunk: pdfChunkName, calculator: '/work-hours-calculator/' }, null, 2) + '\n')
console.log(`Built ${manifest.files.length} preserved paths plus Work Hours & Timesheet Calculator. Entry: ${bundleName}`)
