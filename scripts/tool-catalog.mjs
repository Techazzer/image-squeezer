import { coreTools } from './tool-content.mjs'

// Pages describe use cases; only a distinct implementation belongs in the app.
export function buildToolCatalog(pages) {
  const catalog = Object.entries(coreTools).map(([path, tool]) => ({ path, ...tool, presets: [] }))
  for (const tool of catalog) {
    if (!pages.some(page => page.path === tool.path)) throw Error(`Missing core tool: ${tool.path}`)
  }
  const resources = []
  for (const page of pages) {
    if (coreTools[page.path]) continue
    const match = page.html.match(/<iframe\b[^>]*src="([^"]+)"/i)
    let tool, href
    if (match) {
      const url = new URL(match[1].replaceAll('&amp;', '&'), 'https://aeroniqx.in')
      tool = catalog.find(t => url.origin === 'https://aeroniqx.in' && t.path === url.pathname)
      if (!tool) throw Error(`Unclassified tool page: ${page.path}`)
      url.searchParams.delete('embed')
      url.searchParams.delete('label')
      if (url.search) url.searchParams.set('preset', '1')
      href = url.pathname + url.search
      tool.presets.push({ path: page.path, title: page.title, href })
    } else if (!page.path.startsWith('/how-to-')) {
      throw Error(`Classify the new page before publishing: ${page.path}`)
    }
    resources.push({ path: page.path, title: page.title, category: tool?.category || 'Image', toolPath: tool?.path, href })
  }
  return { catalog, resources }
}
