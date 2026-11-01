import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { header, footer } from './platform-pages.mjs'
import { formatPrice } from '../tools/resources/cart-core.js'

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const hash = value => createHash('sha256').update(value).digest('hex')
export const productPath = product => `/resources/downloads/${product.id}/`

export function validateFreeCatalog(data) {
  if (data.mode !== 'free') throw Error('This release supports free access only; a payment integration is required before charging.')
  if (!data.resources?.length || !data.products?.length) throw Error('A published resource and product are required.')
  const ids = new Set(), slugs = new Set()
  for (const resource of data.resources) {
    if (resource.status !== 'published' || !/^[a-z0-9-]+$/.test(resource.slug) || slugs.has(resource.slug) || !resource.sections?.length) throw Error('Only complete, unique published guides can be listed.')
    slugs.add(resource.slug)
  }
  for (const product of data.products) {
    if (!/^[a-z0-9-]+$/.test(product.id) || ids.has(product.id) || product.status !== 'published') throw Error('Invalid or unpublished product.')
    if (product.pricePaise !== 0 || !Number.isSafeInteger(product.listPricePaise) || product.listPricePaise <= 0) throw Error('Free products must have a zero price and a valid list price.')
    if (!slugs.has(product.resourceSlug) || !product.files?.length || product.files.some(file => !/^[a-z0-9-]+\.(pdf|xlsx)$/.test(file.file))) throw Error('Product downloads must use valid local files and an existing guide.')
    ids.add(product.id)
  }
  for (const resource of data.resources) {
    if (!resource.products?.length || resource.products.some(id => !ids.has(id))) throw Error('A guide references a missing product.')
  }
}

export async function writeLiveBusinessResourcePages(root, dist, { art, icon, sectionMarkup }) {
  const data = JSON.parse(await readFile(path.join(root, 'content/business-resources.json'), 'utf8'))
  validateFreeCatalog(data)
  const source = path.join(root, 'tools/resources')
  const script = await readFile(path.join(source, 'resources.js'), 'utf8')
  const css = await readFile(path.join(source, 'resources.css'), 'utf8')
  const scriptFile = `assets/resources/resources-${hash(script).slice(0,12)}.js`
  const cssFile = `assets/resources/resources-${hash(css).slice(0,12)}.css`
  await mkdir(path.join(dist, 'assets/resources'), { recursive: true })
  await writeFile(path.join(dist, scriptFile), script)
  await writeFile(path.join(dist, cssFile), css)
  await mkdir(path.join(dist, 'downloads/business'), { recursive: true })
  const downloads = []
  for (const product of data.products) {
    for (const file of product.files) {
      const bytes = await readFile(path.join(root, 'content/downloads', file.file))
      const extension = path.extname(file.file)
      if (bytes.length < 1000 || (extension === '.pdf' ? bytes.subarray(0,5).toString() !== '%PDF-' : bytes.subarray(0,2).toString() !== 'PK')) throw Error(`Invalid download: ${file.file}`)
      const sha256 = hash(bytes)
      const output = `downloads/business/${path.basename(file.file,extension)}-${sha256.slice(0,12)}${extension}`
      await writeFile(path.join(dist,output),bytes)
      file.url = '/'+output
      file.size = `${Math.ceil(bytes.length/1024)} KB`
      downloads.push({ file:output, source:`content/downloads/${file.file}`, sha256, bytes:bytes.length, productId:product.id })
    }
  }

  const price = product => `<div class="resource-price"><del aria-label="List price ${formatPrice(product.listPricePaise)}">${formatPrice(product.listPricePaise)}</del><strong>Free</strong><span>No payment required</span></div>`
  const productCard = product => `<article class="resource-product-card"><div class="resource-product-top"><span class="resource-product-icon">${icon(product.files.length > 1 ? 'sheet' : 'file')}</span><span class="resource-tag">${escape(product.format)}</span></div><span class="resource-overline">${escape(product.type)}</span><h3>${escape(product.title)}</h3><p>${escape(product.description)}</p><ul class="resource-includes">${product.includes.map(item => `<li>${icon('check')}<span>${escape(item)}</span></li>`).join('')}</ul><p class="resource-product-status">${escape(product.note)}</p><div class="resource-product-buy">${price(product)}<a class="resource-button" href="${productPath(product)}" aria-label="Buy Now: ${escape(product.title)}, free">Buy Now ${icon('arrow')}</a></div></article>`
  const resourceCard = resource => `<article class="resource-library-card" data-resource-card data-category="${escape(resource.category)}" data-search="${escape([resource.title,resource.category,...resource.tags].join(' ').toLowerCase())}"><a href="/resources/${resource.slug}/" tabindex="-1" aria-hidden="true">${art()}</a><div class="resource-card-body"><div class="resource-card-meta"><span>${escape(resource.category)}</span><span class="resource-status resource-status-live">Free guide</span></div><h2><a href="/resources/${resource.slug}/">${escape(resource.title)}</a></h2><p>${escape(resource.description)}</p><div class="resource-card-bottom"><a class="resource-text-link" href="/resources/${resource.slug}/">Explore guide ${icon('arrow')}</a><span>${resource.products.length} free resources</span></div></div></article>`
  const pages = []
  async function write(slug,title,description,content,section,{indexable=true}={}) {
    const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} | Aeroniqx</title><meta name="description" content="${escape(description)}"><meta name="robots" content="${indexable?'index, follow':'noindex, follow'}"><link rel="canonical" href="https://aeroniqx.in/${slug}/"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="stylesheet" href="/${cssFile}"><script type="module" src="/${scriptFile}"></script></head><body class="platform-page resource-page"><a class="platform-skip" href="#main">Skip to content</a>${header}<main class="platform-main resource-main" id="main"><nav class="resource-nav" aria-label="Business idea"><a class="resource-nav-brand" href="/resources/">${icon('book')}<span>Business idea</span></a><div><a href="/resources/"${section==='library'?' aria-current="page"':''}>Library</a><a href="/resources/banana-leaf-business/#resources">Free resources</a></div></nav>${content}</main>${footer}<noscript><p class="resource-noscript">Guides and downloads work without JavaScript. Enable it to use search filters and checklist progress.</p></noscript></body></html>`
    const file=`${slug}/index.html`
    await mkdir(path.join(dist,slug),{recursive:true})
    await writeFile(path.join(dist,file),page)
    pages.push(file)
  }
  const categories=['All',...new Set(data.resources.map(r=>r.category))]
  const library = `<section class="resource-library-hero"><div><p class="resource-eyebrow">BUSINESS IDEA LIBRARY</p><h1>An idea is just<br>the beginning.</h1><p>Explore the guide. Understand the business.<br>Find the resources to take your next step.</p><a class="resource-text-link" href="/resources/banana-leaf-business/">Start with banana leaves ${icon('arrow')}</a></div><div class="resource-library-intro-card"><span class="resource-product-icon">${icon('book')}</span><h2>From your feed.<br>Into your toolkit.</h2><p>Business guides, practical resources and useful Aeroniqx tools, together in one place.</p><span>All published resources are free right now.</span></div></section><section class="resource-library-section" aria-labelledby="browse-heading"><div class="resource-section-head"><div><p class="resource-eyebrow">EXPLORE THE LIBRARY</p><h2 id="browse-heading">Find your next business idea.</h2></div><label class="resource-search">${icon('search')}<input id="resource-search" type="search" placeholder="Search a business or topic" aria-label="Search business resources" autocomplete="off"></label></div><div class="resource-library-toolbar"><div class="resource-filters" role="group" aria-label="Resource categories">${categories.map(category=>`<button type="button" data-resource-filter="${escape(category)}" aria-pressed="${category==='All'}">${category==='All'?'All resources':escape(category)}</button>`).join('')}</div><p id="resource-result-count" role="status">${data.resources.length} ${data.resources.length===1?'resource':'resources'}</p></div><div class="resource-library-grid">${data.resources.map(resourceCard).join('')}</div><div class="resource-empty" id="resource-search-empty" hidden>${icon('search')}<h3>No resources match your search.</h3><p>Try another topic or browse all resources.</p><button type="button" class="resource-button resource-button-secondary" data-reset-library>Clear filters</button></div></section><aside class="resource-tools-callout"><div class="resource-product-icon">${icon('calculator')}</div><div><h2>Your next step might just need a tool.</h2><p>Explore Aeroniqx calculators, document tools and everyday utilities.</p></div><a class="resource-button resource-button-secondary" href="/tools/">Explore free tools ${icon('arrow')}</a></aside>`
  await write('resources','Business Idea Library','Explore business guides, sourcing resources and practical tools on Aeroniqx.',library,'library')

  for (const resource of data.resources) {
    const products=resource.products.map(id=>data.products.find(p=>p.id===id))
    const resourceNumber=String(resource.sections.length+1).padStart(2,'0'),toolNumber=String(resource.sections.length+2).padStart(2,'0')
    const content=`<nav class="resource-breadcrumb" aria-label="Breadcrumb"><a href="/resources/">Library</a><span>/</span><span>${escape(resource.title)}</span></nav><section class="resource-guide-hero"><div><div class="resource-tags">${resource.tags.map(tag=>`<span class="resource-tag">${escape(tag)}</span>`).join('')}<span class="resource-free-tag">Free guide</span></div><h1>${escape(resource.title)}<span>${escape(resource.subtitle)}</span></h1><p>${escape(resource.description)}</p><div class="resource-hero-actions"><a class="resource-button" href="#overview">Read the guide ${icon('arrow')}</a><a class="resource-text-link" href="#resources">Get the free resources ${icon('download')}</a></div></div>${art()}</section><div class="resource-guide-layout"><aside class="resource-guide-sidebar"><nav aria-label="On this page"><p class="resource-eyebrow">IN THIS GUIDE</p>${resource.sections.map((section,index)=>`<a href="#${section.id}" data-guide-jump${index===0?' aria-current="location"':''}><span>${String(index+1).padStart(2,'0')}</span>${escape(section.title)}</a>`).join('')}<a href="#resources" data-guide-jump><span>${resourceNumber}</span>Business resources</a><a href="#useful-tools" data-guide-jump><span>${toolNumber}</span>Useful tools</a></nav><div class="resource-download-card">${icon('download')}<h3>Your next step, ready to download.</h3><p>The supplier pack and registration guide are free right now.</p><a class="resource-button resource-button-secondary" href="#resources">Get the resources</a></div></aside><div class="resource-guide-body"><div class="resource-editor-note"><strong>Start with a clear specification.</strong><p>Use this guide to plan your first enquiries, then download the supplier pack and export-registration checklist below. Resource research checked 1 November 2026.</p></div>${resource.sections.map(sectionMarkup).join('')}<section id="resources" class="resource-guide-section" data-guide-section><div class="resource-section-heading"><span>${resourceNumber}</span><h2>Resources for your next step</h2></div><p class="resource-section-intro">Both resources are free right now. Choose Buy Now to access the complete files. No payment or account required.</p><div class="resource-products-grid">${products.map(productCard).join('')}</div><p class="resource-access-note">${icon('download')}<span>Complete downloads, ready to use. PDF guides work on your phone; the Excel directory includes filters and a quote tracker.</span></p></section><section id="useful-tools" class="resource-guide-section" data-guide-section><div class="resource-section-heading"><span>${toolNumber}</span><h2>A few tools to help you along</h2></div><div class="resource-related-tools"><a href="/gst-calculator/"><span class="resource-product-icon">${icon('calculator')}</span><div><h3>GST Calculator</h3><p>Add or remove tax using the rate you enter.</p></div>${icon('arrow')}</a><a href="/pdf-merge/"><span class="resource-product-icon">${icon('file')}</span><div><h3>Merge PDFs</h3><p>Bring your documents together in one file.</p></div>${icon('arrow')}</a></div><a class="resource-text-link" href="/tools/">Browse all free tools ${icon('arrow')}</a></section><aside class="resource-next-guide"><div><span class="resource-eyebrow">BUSINESS IDEA LIBRARY</span><h2>Keep your next step simple.</h2><p>Return to your guides and useful Aeroniqx tools.</p></div><a class="resource-button resource-button-secondary" href="/resources/">Back to the library ${icon('arrow')}</a></aside></div></div>`
    await write(`resources/${resource.slug}`,`${resource.title}: Sourcing Guide & Resources`,resource.description,content,'guide')
  }
  for (const product of data.products) {
    const other=data.products.filter(p=>p.id!==product.id)
    const content=`<nav class="resource-breadcrumb" aria-label="Breadcrumb"><a href="/resources/">Library</a><span>/</span><a href="/resources/${product.resourceSlug}/#resources">Banana-leaf resources</a><span>/</span><span>Download</span></nav><section class="resource-delivery"><div class="resource-delivery-intro"><span class="resource-free-tag">Free access</span><h1>${escape(product.title)}</h1><p>${escape(product.description)}</p>${price(product)}<p class="resource-delivery-note">Your files are ready. No payment or sign-up is needed.</p></div><div class="resource-downloads" aria-label="Download files">${product.files.map(file=>`<article class="resource-file-card"><span class="resource-product-icon">${icon(file.format==='Excel'?'sheet':'file')}</span><div><h2>${escape(file.label)}</h2><p>${escape(file.detail)}</p><span>${escape(file.format)} · ${file.size}</span></div><a class="resource-button" href="${file.url}" download="${file.file}" data-resource-download="${product.id}">${icon('download')}<span>${escape(file.label)}</span></a></article>`).join('')}</div><p class="resource-research-note">${escape(product.note)}</p><div class="resource-download-help"><h2>Keep a copy on your device.</h2><p>Your browser saves the file in its Downloads folder or Files app. Open the PDF with a PDF reader. Use Excel or a compatible spreadsheet app for the directory and quote tracker.</p></div><a class="resource-text-link" href="/resources/${product.resourceSlug}/">Back to the business guide ${icon('arrow')}</a></section>${other.length?`<section class="resource-library-section"><div class="resource-section-head"><div><p class="resource-eyebrow">ALSO FREE RIGHT NOW</p><h2>Complete your toolkit.</h2></div></div><div class="resource-products-grid">${other.map(productCard).join('')}</div></section>`:''}`
    await write(productPath(product).slice(1,-1),`Download ${product.title}`,`Get the complete ${product.title.toLowerCase()} free on Aeroniqx.`,content,'download',{indexable:false})
  }
  // Existing cart bookmarks remain useful while the launch offer needs no checkout.
  await write('resources/cart','Get Your Business Resources','Access the complete Aeroniqx business resources for free.',`<section class="resource-cart-hero"><a class="resource-text-link" href="/resources/">← Back to the library</a><h1>Your next step starts here.</h1><p>All resources are free right now. Choose Buy Now to download the files directly.</p></section><div class="resource-products-grid">${data.products.map(productCard).join('')}</div>`,'downloads',{indexable:false})
  return { pages, assets:[scriptFile,cssFile], downloads }
}
