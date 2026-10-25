import assert from 'node:assert/strict'
import { readFile, stat, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const baseline = JSON.parse(await readFile('deployment/production-baseline.json', 'utf8'))
const build = JSON.parse(await readFile('deployment/build.json', 'utf8'))
for (const item of baseline.files) {
  assert.ok((await stat(`dist/${item.file}`)).isFile(), `Preserved path: ${item.file}`)
  if (item.file.startsWith('assets/')) {
    assert.equal(createHash('sha256').update(await readFile(`dist/${item.file}`)).digest('hex'), item.sha256, `Original asset preserved: ${item.file}`)
  }
  if (item.file.endsWith('.html')) {
    const html = await readFile(`dist/${item.file}`, 'utf8')
    assert.doesNotMatch(html, /pagead2\.googlesyndication\.com/, `No ad loader: ${item.file}`)
    for (const [, asset] of html.matchAll(/(?:src|href)=["']\/(assets\/[^"']+)["']/g)) assert.ok((await stat(`dist/${asset}`)).isFile(), `HTML asset exists: ${asset}`)
  }
}
for (const file of [build.entryBundle, build.pdfChunk, 'work-hours-calculator/timesheet.js', 'work-hours-calculator/timesheet-core.js', 'work-hours-calculator/timesheet-view.js']) {
  const result = spawnSync(process.execPath, ['--check', `dist/${file}`], { encoding: 'utf8' })
  assert.equal(result.status, 0, `${file}: ${result.stderr}`)
}
assert.match(await readFile(`dist/${build.pdfChunk}`, 'utf8'), new RegExp(build.entryBundle.replace('assets/', '').replaceAll('.', '\\.')))
assert.doesNotMatch(await readFile(`dist/${build.pdfChunk}`, 'utf8'), /index-Do-dAaN2\.js/)
const tool = await readFile('dist/work-hours-calculator/index.html', 'utf8')
assert.doesNotMatch(tool, /<!--SHIFT_ROWS-->|id="calculator-ui" hidden/)
assert.equal([...tool.matchAll(/class="wh-shift"/g)].length, 7, 'All seven rows have initial layout space')
const home = await readFile('dist/index.html', 'utf8')
assert.ok(tool.includes(build.updatesCss), 'Calculator uses the current shared stylesheet version')
for (const file of build.calculatorAssets) {
  const source = await readFile(`dist/${file}`, 'utf8')
  if (file.endsWith('.js')) {
    assert.equal(spawnSync(process.execPath, ['--check', `dist/${file}`], { encoding: 'utf8' }).status, 0, `Versioned script parses: ${file}`)
    for (const [, dependency] of source.matchAll(/from ['"]\.\/([^'"]+)['"]/g)) assert.ok((await stat(`dist/work-hours-calculator/${dependency}`)).isFile(), `Versioned module dependency exists: ${dependency}`)
  }
}
assert.doesNotMatch(tool, /(?:href|src)="\.\/timesheet\.(?:js|css)"/, 'Calculator entry assets are versioned')
assert.doesNotMatch(home, /mobile-drawer|src="\/assets\/index-/, 'Homepage does not require the legacy tool application')
assert.equal([...home.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m=>m[1]).join(','), '/'+build.mobileApp.script, 'Only the small app shell runs on the homepage')
assert.match(home, /<details class="platform-about-summary">/, 'About and common answers work without JavaScript')
assert.equal([...home.matchAll(/class="platform-tool"/g)].length,6,'Homepage shows six curated tools')
assert.doesNotMatch(home,/class="tool-grid"|Compress Now|FREE TOOLS/, 'Homepage is the focused platform layout')
const directory = await readFile('dist/tools/index.html','utf8')
const webmanifest = JSON.parse(await readFile('dist/manifest.webmanifest','utf8'))
assert.equal(webmanifest.display, 'standalone')
assert.equal(webmanifest.scope, '/')
assert.ok(webmanifest.icons.some(icon=>icon.sizes==='192x192'))
assert.ok(webmanifest.icons.some(icon=>icon.sizes==='512x512'&&icon.purpose==='maskable'))
for(const file of build.mobileApp.assets) assert.ok((await stat(`dist/${file}`)).isFile(), `App asset exists: ${file}`)
for(const icon of webmanifest.icons) {
  const png = await readFile(`dist${icon.src}`)
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a',`PNG signature: ${icon.src}`)
  assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`,icon.sizes,`Icon dimensions: ${icon.src}`)
}
for(const file of [build.mobileApp.script,'service-worker.js']) assert.equal(spawnSync(process.execPath,['--check',`dist/${file}`],{encoding:'utf8'}).status,0,`App script parses: ${file}`)
const catalog = JSON.parse(await readFile(`dist/${build.mobileApp.catalog}`,'utf8'))
assert.equal(new Set(catalog.map(t=>t.path)).size,catalog.length,'Tool catalog paths are unique')
for(const entry of catalog) {
  assert.ok((await stat(`dist${entry.path}index.html`)).isFile(),`App tool exists: ${entry.path}`)
  assert.ok(directory.includes(`href="${entry.path}"`),`Directory has a crawlable tool link: ${entry.path}`)
}
assert.doesNotMatch(tool, /<!--SITE_(?:HEADER|FOOTER)-->/)
assert.match(tool, /canonical" href="https:\/\/aeroniqx.in\/work-hours-calculator\//)
assert.match(await readFile('dist/sitemap.xml','utf8'), /https:\/\/aeroniqx.in\/work-hours-calculator\//)
assert.equal(await readFile('dist/_headers','utf8'), await readFile('deployment/_headers','utf8'))
assert.equal(await readFile('dist/_redirects','utf8'), await readFile('deployment/_redirects','utf8'))
const sitemap = await readFile('dist/sitemap.xml', 'utf8')
const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
assert.equal(new Set(listed).size, listed.length, 'No duplicate sitemap URLs')
const titles = new Set()
let indexable = 0
for (const file of (await readdir('dist', { recursive: true })).filter(f => f.endsWith('.html') && f !== '404.html')) {
  const html = await readFile(`dist/${file}`, 'utf8')
  if (/name="robots"[^>]*content="[^"]*noindex/.test(html)) continue
  indexable++
  const url = 'https://aeroniqx.in/' + file.replaceAll('\\', '/').replace(/index\.html$/, '')
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1]
  assert.ok(title && !titles.has(title), `Unique title: ${file}`)
  titles.add(title)
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1, `One initial-HTML H1: ${file}`)
  assert.match(html, /rel="manifest"/, `App manifest: ${file}`)
  assert.match(html, /aria-label="App navigation"/, `App navigation: ${file}`)
  const appIds = [...html.matchAll(/id="(aero-[^"]+)"/g)].map(m=>m[1])
  assert.equal(appIds.length,new Set(appIds).size,`Unique app control and icon IDs: ${file}`)
  assert.ok(listed.includes(url), `Indexable page in sitemap: ${file}`)
  assert.ok(html.includes(`href="${url}"`), `Self canonical: ${file}`)
  assert.doesNotMatch(html, /privacy-policy-generator|We earn from non-intrusive ads/)
  for (const [, json] of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) JSON.parse(json)
  for (const [, href] of html.matchAll(/href="(\/[^"#?]*)[^"]*"/g)) {
    if (href.startsWith('//') || href.startsWith('/cdn-cgi/')) continue
    const target = href.endsWith('/') ? `${href}index.html` : href
    assert.ok((await stat(`dist${target}`)).isFile(), `Internal link target exists: ${file} -> ${href}`)
  }
}
assert.equal(listed.length, indexable, 'Sitemap includes exactly the indexable pages')
console.log(`SEO checks passed: ${indexable} pages with initial headings, unique titles, valid schema, sitemap coverage and internal links.`)
console.log(`Build checks passed: ${baseline.files.length} original paths, original assets, linked assets, JavaScript syntax, no ad loaders, SEO and hosting rules.`)
