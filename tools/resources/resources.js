const search = document.getElementById('resource-search')
const filters = [...document.querySelectorAll('[data-resource-filter]')]
let category = 'All'
function filterLibrary() {
  const query = (search?.value || '').trim().toLocaleLowerCase()
  let count = 0
  document.querySelectorAll('[data-resource-card]').forEach(card => {
    const visible = (category === 'All' || card.dataset.category === category) && card.dataset.search.includes(query)
    card.hidden = !visible
    if (visible) count++
  })
  const status = document.getElementById('resource-result-count')
  if (status) status.textContent = `${count} ${count === 1 ? 'resource' : 'resources'}${category === 'All' ? '' : ` in ${category.toLocaleLowerCase()}`}`
  const empty = document.getElementById('resource-search-empty')
  if (empty) empty.hidden = count > 0
}
search?.addEventListener('input', filterLibrary)
filters.forEach(button => button.addEventListener('click', () => {
  category = button.dataset.resourceFilter
  filters.forEach(item => item.setAttribute('aria-pressed', String(item === button)))
  filterLibrary()
}))
document.querySelector('[data-reset-library]')?.addEventListener('click', () => {
  search.value = ''; category = 'All'
  filters.forEach(item => item.setAttribute('aria-pressed', String(item.dataset.resourceFilter === 'All')))
  filterLibrary(); search.focus()
})
if (search) filterLibrary()

const checklist = [...document.querySelectorAll('[data-guide-check]')]
checklist.forEach(input => input.addEventListener('change', () => {
  document.getElementById('resource-check-progress').textContent = `${checklist.filter(item => item.checked).length} of ${checklist.length} complete`
}))
const sections = [...document.querySelectorAll('[data-guide-section]')]
if (sections.length && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    const visible = entries.find(entry => entry.isIntersecting)
    if (!visible) return
    document.querySelectorAll('[data-guide-jump]').forEach(link => {
      if (link.hash === `#${visible.target.id}`) link.setAttribute('aria-current', 'location')
      else link.removeAttribute('aria-current')
    })
  }, { rootMargin: '-25% 0px -60% 0px' })
  sections.forEach(section => observer.observe(section))
}
