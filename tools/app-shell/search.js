export function normalizeSearch(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
}

export function findTools(tools, query, category = 'All') {
  const size = String(query).match(/(-?\d+(?:\.\d+)?)\s*(kilobytes?|megabytes?|kb|mb)\b/i)
  const unit = size && (/^(mb|mega)/i.test(size[2]) ? 'MB' : 'KB')
  const target = size && parseAppTarget(size[1], unit)
  const formatMatch = String(query).match(/\b(?:to|as|compress)\s+(?:a\s+)?(jpe?g|png|webp)\b/i)
  const format = formatMatch && (/^jpe?g$/i.test(formatMatch[1]) ? 'jpeg' : formatMatch[1].toLowerCase())
  const words = searchWords(size ? query.replace(size[0], ' ') : query)
  const results = []
  for (const tool of tools) {
    if (category !== 'All' && tool.category !== category) continue
    const text = normalizeSearch([tool.title,tool.path,tool.description,tool.keywords,tool.category].join(' '))
    const coreMatch = words.every(word => text.includes(word))
    const presets = (tool.presets || []).filter(p => words.every(word => normalizeSearch(p.title+' '+p.path).includes(word)))
    if (!coreMatch && !presets.length) continue
    if (size) {
      if (target === null || !['/pdf-compress/','/image-compressor/'].includes(tool.path)) continue
      // A size request means compression, never a separate size-specific tool.
      const params = new URLSearchParams({ target: String(target), unit, preset: '1' })
      if(format && tool.path === '/image-compressor/') params.set('format',format)
      results.push({ ...tool, href: tool.path+'?'+params, context: `Target size: ${target} ${unit}` })
    } else {
      // General queries keep default settings. Apply a preset only when the
      // query identifies one unambiguous configuration beyond the core name.
      const choices = new Set(presets.map(p => p.href))
      const preset = !coreMatch && choices.size === 1 ? presets[0] : null
      if(format && tool.path === '/image-compressor/') {
        results.push({...tool,href:tool.path+'?'+new URLSearchParams({format,preset:'1'}),context:'Output format: '+format.toUpperCase()})
      } else results.push({ ...tool, href: preset?.href || tool.path, ...(preset && preset.href !== tool.path ? { context: 'Preset: '+preset.title } : {}) })
    }
  }
  return results
}

function searchWords(query) {
  return normalizeSearch(query).split(' ').filter(word => word && !['to','for','a','an','the','my','please','under','below','less','than','in','online','free'].includes(word)).map(word => word.length > 3 ? word.replace(/s$/, '') : word)
}

// Shared with the recovered image tool's preset parser. Accept fractional MB
// and KB values above 500 without silently changing the requested target.
export function parseAppTarget(value, unit) {
  if (!/^\d+(?:\.\d+)?$/.test(String(value))) return null
  const target = Number(value), bytes = target * (unit === 'MB' ? 1048576 : 1024)
  return bytes >= 1 && bytes <= 500 * 1048576 ? target : null
}

export function canonicalTool(catalog, path) {
  return catalog.find(t => t.path === path || t.presets?.some(p => p.path === path))
}

export function normalizeSavedTools(saved, catalog) {
  const seen = new Set()
  return saved.flatMap(entry => {
    const tool = canonicalTool(catalog, entry.path) || entry
    if (seen.has(tool.path)) return []
    seen.add(tool.path)
    return [{path:tool.path,title:tool.title,category:tool.category}]
  })
}
