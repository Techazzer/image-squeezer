import { writeLiveBusinessResourcePages } from './business-resources-live.mjs'
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const icons = {
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  book: '<path d="M12 5v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2z"/>',
  cart: '<path d="M3 4h2l3 12h11l2-9H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
  file: '<path d="M14 3H5v18h14V8zM14 3v6h5M8 13h8M8 17h5"/>',
  sheet: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M5 17v4h14v-4"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  calculator: '<rect x="5" y="2" width="14" height="20" rx="3"/><path d="M8 6h8M8 11h1m6 0h1M8 15h1m6 0h1M8 19h1m6 0h1"/>'
}
const icon = name => `<svg class="resource-icon" aria-hidden="true" viewBox="0 0 24 24">${icons[name]}</svg>`

function art(kind = 'leaf') {
  if (kind === 'leaf') return `<div class="resource-art resource-art-leaf" aria-hidden="true"><span class="resource-art-label">FIELD NOTES / 01</span><svg viewBox="0 0 440 280" fill="none"><ellipse cx="244" cy="237" rx="130" ry="15" fill="#b9d4cf" opacity=".35"/><g transform="translate(5 -8) rotate(-13 230 140)"><path d="M85 221C86 109 188 44 350 52c-9 114-100 187-265 169Z" fill="#a4c5a7"/><path d="M106 219C119 121 219 58 365 69c-21 105-103 164-259 150Z" fill="#4b856b"/><path d="M110 218 350 76" stroke="#d1e3b3" stroke-width="3"/><path d="m135 202-4-43m28 28-1-54m25 39 1-56m24 42 5-57m21 42 7-53m18 39 8-49m16 34 9-39m-116 132 50 3m-26-18 61 2m-36-17 67-2m-42-12 70-8m-43-7 63-11m-38-4 50-11" stroke="#c9ddb8" stroke-width="1.4" opacity=".65"/><path d="m109 220-25 15" stroke="#4b856b" stroke-width="5" stroke-linecap="round"/></g><circle cx="81" cy="84" r="28" fill="#fff" opacity=".75"/><path d="m70 84 8 8 15-17" stroke="#1557b0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="resource-art-caption">SOURCE · PLAN · START</span></div>`
  return `<div class="resource-art resource-art-${kind}" aria-hidden="true"><span class="resource-art-label">${kind === 'farm' ? 'FROM THE GROUND UP' : 'MAKE THE FIRST MOVE'}</span><div class="resource-art-glyph">${icon(kind === 'farm' ? 'book' : 'calculator')}</div><span class="resource-art-caption">${kind === 'farm' ? 'FARMING & SOURCING' : 'SMALL BUSINESS'}</span></div>`
}

function sectionMarkup(section, index) {
  return `<section id="${escape(section.id)}" class="resource-guide-section" data-guide-section><div class="resource-section-heading"><span>${String(index + 1).padStart(2, '0')}</span><h2>${escape(section.title)}</h2></div>${section.intro ? `<p class="resource-section-intro">${escape(section.intro)}</p>` : ''}${section.points ? `<div class="resource-points">${section.points.map(point => `<div><h3>${escape(point.title)}</h3><p>${escape(point.text)}</p></div>`).join('')}</div>` : ''}${section.checklist ? `<p class="resource-section-intro">Work through the steps as you explore the idea.</p><div class="resource-checklist">${section.checklist.map(item => `<label><input type="checkbox" data-guide-check><span>${escape(item)}</span></label>`).join('')}</div><p id="resource-check-progress" class="resource-small" role="status">0 of ${section.checklist.length} complete</p>` : ''}</section>`
}

export async function writeBusinessResourcePages(root, dist) {
  return writeLiveBusinessResourcePages(root, dist, { art, icon, sectionMarkup })
}
