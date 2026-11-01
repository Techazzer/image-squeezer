import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { resourceStorePolicies } from './resource-store-policies.mjs'

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const landingPath = resource => `/${resource.landingSlug}/`
export const landingProductPath = (resource, product) => `${landingPath(resource)}${product.id}/`

// A separate document shell keeps the entire acquisition/delivery journey on topic.
// These pages are deliberately not returned in the app-shell injection list.
export async function writeResourceLandingPages(dist, data, { art, icon, sectionMarkup, price, productCard, scriptFile, cssFile }) {
  const refundPolicy = JSON.parse(await readFile(new URL('../content/resource-refund-policy.json', import.meta.url), 'utf8'))
  const seller = JSON.parse(await readFile(new URL('../content/resource-seller.json', import.meta.url), 'utf8'))
  const pages = []
  for (const resource of data.resources.filter(item => item.landingSlug)) {
    const base = landingPath(resource)
    const products = resource.products.map(id => data.products.find(item => item.id === id))
    const card = product => productCard(product, { href: landingProductPath(resource, product) })
    const topic = `${resource.title} toolkit`
    const updated = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(resource.updatedAt))

    async function write(route, title, description, content, { delivery = false, policy = false } = {}) {
      const folder = path.join(dist, route.slice(1))
      // A content slug must never replace an existing tool or platform route.
      try {
        await readFile(path.join(folder, 'index.html'))
        throw Error(`Standalone resource route already exists: ${route}`)
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
      const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title><meta name="description" content="${escape(description)}">
<meta name="robots" content="${delivery ? 'noindex' : 'index'}, follow"><meta name="theme-color" content="#f6f8fc">
<link rel="canonical" href="https://aeroniqx.in${route}"><link rel="stylesheet" href="/${cssFile}">
${delivery || policy ? '' : `<script type="module" src="/${scriptFile}"></script>`}</head>
<body class="platform-page resource-page resource-standalone">
<a class="resource-landing-skip" href="#main">Skip to content</a>
<header class="resource-landing-header"><div><span class="resource-landing-name">${icon('book')}${escape(topic)}</span>${delivery || policy ? `<a href="${base}#resources">All resources ${icon('arrow')}</a>` : '<nav aria-label="Resource navigation"><a href="#resources">Resources</a><a href="#overview">Guide</a></nav>'}</div></header>
<main class="resource-main" id="main">${content}</main>
<footer class="resource-landing-footer"><div><p>${escape(topic)}</p><span>By ${escape(seller.legalName)} · Research checked ${escape(updated)}</span></div><nav aria-label="Resource information"><a href="${base}about/">About</a><a href="${base}contact/">Contact</a><a href="${base}terms/">Terms</a><a href="${base}privacy/">Privacy</a><a href="${base}refund-policy/">Refund policy</a></nav></footer>
</body></html>`
      await mkdir(folder, { recursive: true })
      await writeFile(path.join(folder, 'index.html'), html)
      pages.push(`${route.slice(1)}index.html`)
    }

    const landing = `<section class="resource-guide-hero">
<div><div class="resource-tags">${resource.tags.map(tag => `<span class="resource-tag">${escape(tag)}</span>`).join('')}<span class="resource-free-tag">Free access right now</span></div>
<h1>${escape(resource.title)}<span>${escape(resource.subtitle)}</span></h1>
<p>Read the starting guide, build your supplier shortlist and prepare for export registration. Get the complete supplier directory and registration guide below.</p>
<div class="resource-hero-actions"><a class="resource-button" href="#resources">Get the resources ${icon('arrow')}</a><a class="resource-text-link" href="#overview">Read the guide</a></div>
<p class="resource-landing-assurance">PDF + Excel downloads · No payment or sign-up required</p></div>${art()}</section>
<section id="resources" class="resource-landing-offers" aria-labelledby="resources-title"><div class="resource-section-head"><div><p class="resource-eyebrow">YOUR NEXT STEP</p><h2 id="resources-title">Choose your resource.</h2></div></div>
<p class="resource-section-intro">Both resources are free right now. Tap Buy Now to access the complete files.</p>
<div class="resource-products-grid">${products.map(card).join('')}</div><p class="resource-offer-policy">For paid purchases: no change-of-mind refunds after purchase. <a href="${base}refund-policy/">Read the cancellation &amp; refund policy</a>.</p></section>
<div class="resource-guide-layout resource-landing-guide"><aside class="resource-guide-sidebar"><nav aria-label="In this guide"><p class="resource-eyebrow">THE STARTING GUIDE</p>${resource.sections.map((section, index) => `<a href="#${escape(section.id)}" data-guide-jump${index === 0 ? ' aria-current="location"' : ''}><span>${String(index + 1).padStart(2, '0')}</span>${escape(section.title)}</a>`).join('')}</nav></aside>
<div class="resource-guide-body"><div class="resource-editor-note"><strong>Start with a clear specification.</strong><p>Use these steps to plan your first enquiries. Keep your buyer’s requirements, quotes and checks together before committing to an order.</p></div>${resource.sections.map(sectionMarkup).join('')}
<div class="resource-landing-return"><a class="resource-button" href="#resources">Get the resources ${icon('arrow')}</a></div></div></div>`
    await write(base, `${resource.title} toolkit — Supplier directory & export guide`, 'Explore banana-leaf sourcing and export. Get the supplier directory, Excel tracker and export-registration guide, free right now.', landing)

    for (const product of products) {
      const others = products.filter(item => item.id !== product.id)
      const content = `<section class="resource-delivery"><a class="resource-text-link" href="${base}#resources">← Back to ${escape(resource.title.toLowerCase())} resources</a>
<div class="resource-delivery-intro"><span class="resource-free-tag">Free access</span><h1>${escape(product.title)}</h1><p>${escape(product.description)}</p>${price(product)}<p class="resource-delivery-note">Your files are ready. No payment or sign-up is needed.</p></div>
<div class="resource-downloads" aria-label="Download files">${product.files.map(file => `<article class="resource-file-card"><span class="resource-product-icon">${icon(file.format === 'Excel' ? 'sheet' : 'file')}</span><div><h2>${escape(file.label)}</h2><p>${escape(file.detail)}</p><span>${escape(file.format)} · ${file.size}</span></div><a class="resource-button" href="${file.url}" download="${file.file}" data-resource-download="${product.id}">${icon('download')}<span>${escape(file.label)}</span></a></article>`).join('')}</div>
<p class="resource-research-note">${escape(product.note)}</p><div class="resource-download-help"><h2>Keep a copy on your device.</h2><p>Your browser saves the file in its Downloads folder or Files app. Open the PDF with a PDF reader. Use Excel or a compatible spreadsheet app for the directory and quote tracker.</p></div>
<a class="resource-text-link" href="${base}#overview">Read the starting guide ${icon('arrow')}</a></section>
${others.length ? `<section class="resource-library-section"><div class="resource-section-head"><div><p class="resource-eyebrow">FOR YOUR BANANA-LEAF BUSINESS</p><h2>Complete your toolkit.</h2></div></div><div class="resource-products-grid">${others.map(card).join('')}</div></section>` : ''}`
      await write(landingProductPath(resource, product), `Download ${product.title} — ${topic}`, `Get the complete ${product.title.toLowerCase()}, free right now.`, content, { delivery: true })
    }
    const policyDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(refundPolicy.updatedAt))
    const policyContent = `<article class="resource-policy"><a class="resource-text-link" href="${base}#resources">← Back to the resources</a><p class="resource-eyebrow">DIGITAL RESOURCES · UPDATED ${escape(policyDate)}</p><h1>${escape(refundPolicy.title)}</h1><p class="resource-policy-summary">${escape(refundPolicy.summary)}</p>${data.mode === 'free' ? '<aside class="resource-editor-note"><strong>Currently available free</strong><p>Payments are not enabled yet. This policy describes the terms for future paid purchases; free downloads carry no charge.</p></aside>' : ''}${refundPolicy.sections.map(section => `<section><h2>${escape(section.title)}</h2><p>${escape(section.text)}</p></section>`).join('')}<div class="resource-policy-contact"><h2>Resource support</h2><a href="mailto:${escape(refundPolicy.supportEmail)}">${escape(refundPolicy.supportEmail)}</a></div></article>`
    await write(`${base}refund-policy/`, `${refundPolicy.title} — ${topic}`, 'Cancellation, refund and support terms for the banana-leaf digital resources.', policyContent, { policy: true })
    for (const info of resourceStorePolicies(resource, seller, data.mode)) {
      const content = `<article class="resource-policy"><a class="resource-text-link" href="${base}#resources">← Back to the resources</a><p class="resource-eyebrow">${escape(seller.legalName)} · UPDATED ${escape(policyDate)}</p><h1>${escape(info.title)}</h1><p class="resource-policy-summary">${info.summary}</p>${info.content}</article>`
      await write(`${base}${info.slug}/`, `${info.title} — ${topic}`, `${info.title} for the banana-leaf digital resources from ${seller.legalName}.`, content, { policy: true })
    }
  }
  return pages
}
