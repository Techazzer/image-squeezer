export function normalizeSearch(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
}

export function findTools(tools, query, category = 'All') {
  const words = normalizeSearch(query).split(' ').filter(Boolean)
  return tools.filter(tool => {
    if (category !== 'All' && tool.category !== category) return false
    const text = normalizeSearch([tool.title,tool.path,tool.description,tool.keywords,tool.category].join(' '))
    return words.every(word => text.includes(word))
  })
}
