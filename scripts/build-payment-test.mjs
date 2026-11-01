import { readFile, writeFile, mkdir, cp, readdir, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resourceStorePolicies } from './resource-store-policies.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export async function buildPaymentCheckout(mode = 'test') {
assert.ok(['test', 'live'].includes(mode))
const live = mode === 'live'
const directory = `tools/payments-${mode}`
const target = path.join(root, directory, 'dist')
assert.equal(path.relative(root, target).replaceAll('\\', '/'), `${directory}/dist`)
await rm(target, { recursive: true, force: true })
await mkdir(path.join(target, 'banana-leaf'), { recursive: true })
const catalog = JSON.parse(await readFile(path.join(root, 'content/business-resources.json'), 'utf8'))
const products = catalog.products.map(product => ({ id: product.id, title: product.title, amount: product.listPricePaise, files: product.files }))
assert.deepEqual(products.map(p => [p.id, p.amount]), [['banana-leaf-suppliers', 9900], ['export-registration-guide', 4900]])
let html = await readFile(path.join(root, 'dist/banana-leaf/index.html'), 'utf8')
const assets = [...new Set([...html.matchAll(/(?:src|href)="\/(assets\/[^"?#]+)"/g)].map(match => match[1]))]
for (const file of assets) { await mkdir(path.dirname(path.join(target, 'banana-leaf', file)), { recursive: true }); await cp(path.join(root, 'dist', file), path.join(target, 'banana-leaf', file)) }
for (const file of ['checkout.js', 'checkout.css']) {
  await mkdir(path.join(target, 'banana-leaf/assets/payments-test'), { recursive: true })
  await cp(path.join(root, 'tools/payments-test', file), path.join(target, 'banana-leaf/assets/payments-test', file))
  assets.push(`assets/payments-test/${file}`)
}
const title = live ? 'Banana-leaf business toolkit — Supplier directory & export guide' : 'Banana-leaf business — Razorpay test checkout'
html = html.replace(/<title>[^<]+<\/title>/, `<title>${title}</title>`)
  .replace(/<link rel="canonical"[^>]+>/, '')
  .replace('content="index, follow"', 'content="noindex, nofollow"')
  .replace('</head>', '<link rel="stylesheet" href="/assets/payments-test/checkout.css"><script type="module" src="/assets/payments-test/checkout.js"></script></head>')
  .replace('<header class="resource-landing-header">', live ? '<header class="resource-landing-header">' : '<div class="test-banner"><strong>RAZORPAY TEST MODE</strong><span>No real money is charged.</span></div><header class="resource-landing-header">')
  .replace('Free access right now', live ? 'Practical business resources' : 'Test checkout')
  .replace('PDF + Excel downloads · No payment or sign-up required', live ? 'Secure Razorpay checkout · Instant downloads after payment' : 'Complete PDF + Excel downloads unlock after a verified test payment.')
  .replace('Both resources are free right now. Tap Buy Now to access the complete files.', live ? 'Get the complete supplier directory for ₹99 or export-registration guide for ₹49. One-time payment, with instant downloads after payment is verified.' : 'Test the ₹99 supplier directory or ₹49 registration guide. This checkout uses Razorpay Test Mode only.')
  .replace('export-registration guide, free right now.', 'export-registration guide.')
  .replaceAll('="/assets/', '="/banana-leaf/assets/')
for (const product of products) {
  const amount = `₹${product.amount / 100}`
  const price = `<div class="resource-price"><del aria-label="List price ${amount}">${amount}</del><strong>Free</strong><span>No payment required</span></div>`
  assert.ok(html.includes(price), `Expected list price for ${product.id}`)
  html = html.replace(price, `<div class="resource-price"><strong>${amount}</strong><span>${live ? 'One-time payment · INR' : 'Test payment · INR'}</span></div>`)
  const buy = new RegExp(`<a class="resource-button" href="/banana-leaf/${product.id}/"[^>]*>Buy Now ([\\s\\S]*?)</a>`)
  assert.ok(buy.test(html), `Expected Buy Now link for ${product.id}`)
  html = html.replace(buy, `<button type="button" class="resource-button" data-test-buy="${product.id}" disabled>Buy Now $1</button>`)
}
const checkout = `<section id="checkout-status" data-mode="${mode}" class="test-checkout" aria-labelledby="checkout-title"><h2 id="checkout-title">${live ? 'Your purchase & downloads' : 'Your test checkout'}</h2><p id="checkout-message" role="status" aria-live="polite">${live ? 'Connecting to secure checkout…' : 'Connecting to the test checkout…'}</p><div class="checkout-actions"><button class="resource-button" type="button" id="recover-payment" hidden>Check payment status</button><button class="resource-button resource-button-secondary" type="button" id="check-setup" hidden>Check again</button><button class="resource-button resource-button-secondary" type="button" id="reset-test">${live ? 'Choose another resource' : 'Start another test'}</button></div><div id="test-downloads" hidden></div><p>${live ? 'After payment, download your files and save your private access link. You can reopen downloads for one year; downloaded files are yours to keep. For payment or download help, contact <a href="mailto:techazzer@gmail.com">techazzer@gmail.com</a> with your payment reference. Please check payment status before paying again.' : 'Only simulated payments are accepted here. Test access lasts 24 hours in this browser. This page stores a test order reference in session storage and uses secure cookies for access. Razorpay handles the test checkout; do not enter real card details.'}</p><noscript>Enable JavaScript to use secure checkout and download your purchase.</noscript></section>`
html = html.replace('<div class="resource-guide-layout resource-landing-guide">', `${checkout}<div class="resource-guide-layout resource-landing-guide">`)
await writeFile(path.join(target, 'banana-leaf/index.html'), html)
const publicPaths = ['/banana-leaf/', ...assets.map(file => `/banana-leaf/${file}`)]
for (const policy of ['about', 'contact', 'terms', 'privacy', 'refund-policy']) {
  const folder = path.join(target, 'banana-leaf', policy); await mkdir(folder, { recursive: true })
  let page = await readFile(path.join(root, `dist/banana-leaf/${policy}/index.html`), 'utf8')
  page = page.replace(/<link rel="canonical"[^>]+>/, '').replace('content="index, follow"', 'content="noindex, nofollow"')
    .replace('<header class="resource-landing-header">', live ? '<header class="resource-landing-header">' : '<div style="padding:12px;text-align:center;background:#fff1ce;color:#6b4d0b">Test environment · No real money is charged. Policies below describe the resource storefront.</div><header class="resource-landing-header">')
    .replaceAll('="/assets/', '="/banana-leaf/assets/')
  if (live) {
    const seller = JSON.parse(await readFile(path.join(root, 'content/resource-seller.json'), 'utf8'))
    const info = resourceStorePolicies(catalog.resources[0], seller, 'live').find(item => item.slug === policy)
    if (info) page = page.replace(/(<p class="resource-policy-summary">)[\s\S]*?<\/article>/, `$1${info.summary}</p>${info.content}</article>`)
    else page = page.replace(/<aside class="resource-editor-note"><strong>Currently available free<\/strong>[\s\S]*?<\/aside>/, '')
  }
  await writeFile(path.join(folder, 'index.html'), page); publicPaths.push(`/banana-leaf/${policy}/`)
}
await mkdir(path.join(target, '_private'), { recursive: true })
const files = []
for (const product of products) for (const file of product.files) {
  assert.match(file.file, /^[a-z0-9-]+\.(pdf|xlsx)$/)
  const bytes = await readFile(path.join(root, 'content/downloads', file.file))
  await writeFile(path.join(target, '_private', file.file), bytes)
  files.push({ file: file.file, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length })
}
await writeFile(path.join(target, 'robots.txt'), 'User-agent: *\nDisallow: /\n'); publicPaths.push('/robots.txt')
await writeFile(path.join(root, directory, 'manifest.generated.js'), `export const products = ${JSON.stringify(products)}\nexport const publicPaths = ${JSON.stringify(publicPaths)}\n`)
assert.equal([...html.matchAll(/data-test-buy=/g)].length, 2)
assert.doesNotMatch(html, /<strong>Free<\/strong>|\/downloads\/business\/|href="\/banana-leaf\/(?:banana-leaf-suppliers|export-registration-guide)\//)
assert.ok(!publicPaths.some(p => p.startsWith('/_private/')))
const fileCount = (await readdir(target, { recursive: true })).length
if (live) assert.doesNotMatch(html, /RAZORPAY TEST MODE|No real money|free right now|Test payment/)
console.log(JSON.stringify({ target: `aeroniqx-payments-${mode}`, mode, prices: products.map(p => ({ id: p.id, paise: p.amount })), publicPaths, privateFiles: files, generatedEntries: fileCount }, null, 2))
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildPaymentCheckout('test')
