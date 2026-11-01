import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { buildPaymentCheckout } from './build-payment-test.mjs'

// Apply only after live credentials are verified and the custom-domain Worker is ready.
export async function preparePaidResourcePages(root, dist, mobileApp) {
  const release = JSON.parse(await readFile(path.join(root, 'content/payment-release.json'), 'utf8'))
  if (!release.live) return
  await buildPaymentCheckout('live')
  const workerDist = path.join(root, 'tools/payments-live/dist')
  const catalog = JSON.parse(await readFile(path.join(root, 'content/business-resources.json'), 'utf8'))
  // Remove the current free file copies from Pages; paid files exist only in Worker assets.
  for (const file of mobileApp.businessResourceDownloads) {
    const target = path.resolve(dist, file.file)
    assert.ok(target.startsWith(path.resolve(dist, 'downloads/business') + path.sep))
    await rm(target)
  }
  mobileApp.businessResourceDownloads = []
  mobileApp.businessResourcePaymentMode = 'live'
  // Preserve the library and guide, with all purchase links leading to the standalone checkout.
  for (const file of mobileApp.businessResourcePages) {
    let html = await readFile(path.join(dist, file), 'utf8')
    for (const product of catalog.products) {
      const amount = `₹${product.listPricePaise / 100}`
      html = html.replaceAll(`<del aria-label="List price ${amount}">${amount}</del><strong>Free</strong><span>No payment required</span>`, `<strong>${amount}</strong><span>One-time payment · INR</span>`)
        .replaceAll(`href="/resources/downloads/${product.id}/"`, 'href="/banana-leaf/#resources"')
        .replaceAll(`aria-label="Buy Now: ${product.title}, free"`, `aria-label="Buy Now: ${product.title}, ${amount}"`)
    }
    html = html.replaceAll('Free resources', 'Business resources').replaceAll('free resources', 'business resources')
      .replaceAll('All published resources are free right now.', 'Read the free starting guide and choose a practical business resource.')
      .replaceAll('The supplier pack and registration guide are free right now.', 'Buy the supplier pack for ₹99 or registration guide for ₹49.')
      .replaceAll('Get the free resources', 'Get the resources')
      .replaceAll('Both resources are free right now. Choose Buy Now to access the complete files. No payment or account required.', 'Buy the supplier directory for ₹99 or registration guide for ₹49. Secure checkout and downloads open on the resource page.')
      .replaceAll('All resources are free right now. Choose Buy Now to download the files directly.', 'Choose a resource to open secure checkout and download your purchase.')
    if (file.startsWith('resources/downloads/')) {
      html = html.replace(/<main\b[^>]*>[\s\S]*?<\/main>/, '<main class="platform-main resource-main" id="main"><section class="resource-delivery"><h1>Get your business resource</h1><p>The supplier directory is ₹99 and the export-registration guide is ₹49. Purchase and download your files on the resource page.</p><a class="resource-button" href="/banana-leaf/#resources">View resources</a></section></main>')
        .replace(/<meta name="description"[^>]+>/, '<meta name="description" content="Purchase and download your banana-leaf business resources.">')
    }
    await writeFile(path.join(dist, file), html)
  }
  const copied = ['banana-leaf/index.html', ...['about', 'contact', 'terms', 'privacy', 'refund-policy'].map(p => `banana-leaf/${p}/index.html`)]
  for (const file of copied) await cp(path.join(workerDist, file), path.join(dist, file))
  await mkdir(path.join(dist, 'banana-leaf/assets'), { recursive: true })
  await cp(path.join(workerDist, 'banana-leaf/assets'), path.join(dist, 'banana-leaf/assets'), { recursive: true })
  for (const product of catalog.products) {
    const file = `banana-leaf/${product.id}/index.html`
    let html = await readFile(path.join(dist, file), 'utf8')
    html = html.replace(/<main\b[^>]*>[\s\S]*?<\/main>/, `<main class="resource-main" id="main"><section class="resource-delivery"><h1>${product.title}</h1><p>Purchase this resource and access your files through secure checkout.</p><a class="resource-button" href="/banana-leaf/#resources">View resource &amp; Buy Now</a></section></main>`)
      .replace(/<meta name="description"[^>]+>/, '<meta name="description" content="Purchase and download your banana-leaf business resource.">')
    await writeFile(path.join(dist, file), html)
  }
}
