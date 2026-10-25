import { readFile, writeFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { compactHelpHtml } from './compact-tools.mjs'

export const contentReplacements = [
  ['Aero Tools', 'Aeroniqx'],
  ['AeroTools', 'Aeroniqx'],
  ['Free online image & PDF tools — compress, resize, and convert 100% in your browser. No uploads. No sign-up. No watermark.', 'Useful tools for work, money, documents and creative tasks. Free to use, with no ads or Aeroniqx account.'],
  ['Free online image, PDF & productivity tools — compress, resize, and convert 100% in your browser. No uploads. No sign-up. No watermark.', 'Useful tools for work, money, documents and creative tasks. Free to use, with no ads or Aeroniqx account.'],
  ['All processing in your browser.', 'Everyday tools, made simple.'],
  ['/privacy-policy-generator/', '/privacy/'],
  ['We make', 'Free tools.'],
  ['files easy.', 'Every day.'],
  ['Compress images & PDFs to exact size targets — for government exams, email, WhatsApp, and more. Free, instant, nothing uploaded.', 'Free image and PDF tools, work hours and finance calculators. Compress, resize, convert and calculate in your browser. No ads or signup.'],
  ['Image compression, format conversion, exam photo presets, social media resizing — and more coming soon.', 'Find image compressors, PDF converters, exam photo presets, work hours tools and finance calculators in one place.'],
  ['No limits at all. Files of any size, as many times as you want, every day. Completely free, forever. We earn from non-intrusive ads.', 'Our tools are free, with no ads, account or daily usage limit. Large files depend on the memory available on your device.'],
]

const titles = {
  home: 'Aeroniqx — Free Online Tools for Everyday Tasks',
  'image-compressor': 'Free Image Compressor & Resizer | Aeroniqx',
  'pdf-compress': 'Compress PDF Online Free — No Upload | Aeroniqx',
  'pdf-merge': 'Merge PDF Files Online Free | Aeroniqx',
  'pdf-split': 'Split PDF & Extract Pages Online Free | Aeroniqx',
  'pdf-to-images': 'Convert PDF to JPG or PNG Online Free | Aeroniqx',
  'images-to-pdf': 'Convert Images to PDF Online Free | Aeroniqx',
  'handwriting-font': 'Handwriting Font Generator — Free TTF Font | Aeroniqx',
  'drive-folder-copy': 'Google Drive Folder Copier | Aeroniqx',
  'emi-calculator': 'EMI Calculator — Loan Payments & Interest | Aeroniqx',
  'gst-calculator': 'GST Calculator — Add or Remove GST | Aeroniqx',
  'sip-calculator': 'SIP Calculator — Monthly Investment Returns | Aeroniqx',
  'salary-calculator': 'Salary Calculator — CTC to Take-Home Pay | Aeroniqx',
}
const homeDescription = 'Free image and PDF tools, work hours and finance calculators. Compress, resize, convert and calculate in your browser. No ads or signup.'
const escape = text => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const origin = 'https://aeroniqx.in'
const decode = text => text.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'")
export function updateCopy(html) {
  for (const [from, to] of contentReplacements) html = html.replaceAll(from, to).replaceAll(escape(from), escape(to))
  return html
}

export async function updateClientTitles(root, bundle) {
  for (const [slug, title] of Object.entries(titles)) {
    const snapshot = JSON.parse(await readFile(path.join(root, 'tools/prerender', `${slug}.json`), 'utf8'))
    bundle = bundle.replaceAll(snapshot.title, title)
  }
  return bundle
}

export async function addSearchContent(root, dist) {
  const sourceDir = path.join(root, 'tools/prerender')
  const entries = (await readdir(sourceDir)).filter(f => f.endsWith('.json')).sort()
  for (const file of entries) {
    const slug = file.slice(0, -5)
    const snapshot = JSON.parse(await readFile(path.join(sourceDir, file), 'utf8'))
    const target = slug === 'home' ? 'index.html' : `${slug}/index.html`
    let html = await readFile(path.join(dist, target), 'utf8')
    if (!html.includes('<div id="root"></div>') || !snapshot.html.includes('<h1')) throw new Error(`Invalid prerender source: ${slug}`)
    const title = titles[slug]
    if (!title) throw new Error(`Missing search title: ${slug}`)
    const description = slug === 'home' ? homeDescription : snapshot.description
    const url = slug === 'home' ? `${origin}/` : `${origin}/${slug}/`
    let content = compactHelpHtml(updateCopy(snapshot.html))
      .replace(/ data-discover="true"/g, '')
      .replace(/<div class="ad-slot[^>]*>[\s\S]*?<\/ins><\/div>/g, '')
    // The decorative download mockup must not be a keyboard-focusable control.
    content = content.replace(/<button([^>]*class="[^"]*mock[^"]*"[^>]*)>([\s\S]*?)<\/button>/g, '<span$1>$2</span>')
    html = html.replace('<div id="root"></div>', `<div id="root">${content}</div>`)
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escape(title)}</title>`)
      .replace(/<meta\b[^>]*(?:name="(?:description|twitter:title|twitter:description)"|property="og:(?:title|description|url)")[^>]*>/gi, '')
      .replace(/<link\b[^>]*rel="canonical"[^>]*>/gi, '')
      .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')
    const schema = slug === 'home'
      ? { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Aeroniqx — Aero Tools', url, description }
      : { '@context': 'https://schema.org', '@type': 'WebApplication', name: snapshot.h1, url, description, applicationCategory: slug.includes('calculator') ? 'FinanceApplication' : 'UtilitiesApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' } }
    html = html.replace('</head>', `<meta name="description" content="${escape(description)}">\n<link rel="canonical" href="${url}">\n<meta property="og:title" content="${escape(title)}">\n<meta property="og:description" content="${escape(description)}">\n<meta property="og:url" content="${url}">\n<meta name="twitter:title" content="${escape(title)}">\n<meta name="twitter:description" content="${escape(description)}">\n<script type="application/ld+json">${JSON.stringify(schema).replaceAll('<', '\\u003c')}</script>\n</head>`)
    await writeFile(path.join(dist, target), html)
  }

  const sitemapPages = await writeSitemap(dist)
  return { prerendered: entries.length, sitemapPages }
}

export async function writeSitemap(dist) {
  const pages = (await readdir(dist, { recursive: true })).filter(f => f.endsWith('.html')).sort()
  const urls = []
  for (const file of pages) {
    let html = updateCopy(await readFile(path.join(dist, file), 'utf8'))
    await writeFile(path.join(dist, file), html)
    if (/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html) || file === '404.html') continue
    const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1]
    const normalized = file.replaceAll('\\', '/')
    const expected = origin + '/' + normalized.replace(/index\.html$/, '')
    if (!canonical || decode(canonical) !== expected) throw new Error(`Non-self canonical in ${file}: ${canonical}`)
    urls.push(canonical)
  }
  await writeFile(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${escape(url)}</loc></url>`).join('\n')}\n</urlset>\n`)
  return urls.length
}
