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
assert.ok(home.includes(build.updatesCss) && tool.includes(build.updatesCss), 'Both pages use the current stylesheet version')
for (const file of build.calculatorAssets) {
  const source = await readFile(`dist/${file}`, 'utf8')
  if (file.endsWith('.js')) {
    assert.equal(spawnSync(process.execPath, ['--check', `dist/${file}`], { encoding: 'utf8' }).status, 0, `Versioned script parses: ${file}`)
    for (const [, dependency] of source.matchAll(/from ['"]\.\/([^'"]+)['"]/g)) assert.ok((await stat(`dist/work-hours-calculator/${dependency}`)).isFile(), `Versioned module dependency exists: ${dependency}`)
  }
}
assert.doesNotMatch(tool, /(?:href|src)="\.\/timesheet\.(?:js|css)"/, 'Calculator entry assets are versioned')
assert.doesNotMatch(home, /<script[^>]*src=|mobile-drawer/, 'Homepage does not require the tool application')
assert.match(home, /<details class="faq-item">/, 'FAQ works without JavaScript')
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
