import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
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
for (const file of [build.entryBundle, build.pdfChunk, 'work-hours-calculator/timesheet.js', 'work-hours-calculator/timesheet-core.js']) {
  const result = spawnSync(process.execPath, ['--check', `dist/${file}`], { encoding: 'utf8' })
  assert.equal(result.status, 0, `${file}: ${result.stderr}`)
}
assert.match(await readFile(`dist/${build.pdfChunk}`, 'utf8'), new RegExp(build.entryBundle.replace('assets/', '').replaceAll('.', '\\.')))
assert.doesNotMatch(await readFile(`dist/${build.pdfChunk}`, 'utf8'), /index-Do-dAaN2\.js/)
const tool = await readFile('dist/work-hours-calculator/index.html', 'utf8')
assert.doesNotMatch(tool, /<!--SITE_(?:HEADER|FOOTER)-->/)
assert.match(tool, /canonical" href="https:\/\/aeroniqx.in\/work-hours-calculator\//)
assert.match(await readFile('dist/sitemap.xml','utf8'), /https:\/\/aeroniqx.in\/work-hours-calculator\//)
assert.equal(await readFile('dist/_headers','utf8'), await readFile('deployment/_headers','utf8'))
assert.equal(await readFile('dist/_redirects','utf8'), await readFile('deployment/_redirects','utf8'))
console.log(`Build checks passed: ${baseline.files.length} original paths, original assets, linked assets, JavaScript syntax, no ad loaders, SEO and hosting rules.`)
