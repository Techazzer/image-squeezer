(() => {
  if (new URLSearchParams(location.search).get('embed') === '1') {
    document.documentElement.dataset.aeroEmbed = 'true'
    return
  }
  const $ = id => document.getElementById(id)
  const library = $('aero-library'), install = $('aero-install')
  if (!library || !install) return
  const storageKey = 'aeroniqx.saved-tools.v1'
  const icons = { Image:'image', PDF:'file', Work:'clock', Finance:'calculator', More:'grid' }
  const icon = name => `<svg class="aero-icon" aria-hidden="true"><use href="#aero-symbol-${name}"></use></svg>`
  let saved = [], catalog, catalogRequest, activeCategory = 'All', savedOnly = false, installPrompt, lastPath, lastFocus
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || '[]')
    saved = Array.isArray(value) ? value.filter(t => t && /^\/[a-z0-9-]+\/$/.test(t.path) && typeof t.title === 'string' && t.title.length < 180).slice(0,100) : []
  } catch { /* Local storage is optional. */ }
  const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  let toastTimer
  function notify(message) {
    $('aero-toast').textContent = message
    $('aero-toast').hidden = false
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { $('aero-toast').hidden = true }, 3300)
  }
  function currentTool() {
    const path = location.pathname.replace(/\/?$/, '/')
    if (['/','/about/','/privacy/','/offline/'].includes(path)) return null
    const title = document.querySelector('h1')?.textContent.trim().replace(/\s+/g,' ') || document.title.split(' | ')[0]
    return { path, title: title.slice(0,160), category: /work-hours/.test(path)?'Work':/calculator/.test(path)?'Finance':/pdf/.test(path)?'PDF':/drive|handwriting/.test(path)?'More':'Image' }
  }
  function syncRoute() {
    const tool = currentTool()
    lastPath = location.pathname
    $('aero-page-name').textContent = tool?.title || 'Aeroniqx'
    $('aero-page-name').hidden = !tool
    $('aero-brand').hidden = !!tool
    $('aero-back').hidden = !tool
    $('aero-home-label').hidden = !!tool
    $('aero-save-page').hidden = !tool
    $('aero-nav-home').toggleAttribute('aria-current', !tool)
    if (!tool) $('aero-nav-home').setAttribute('aria-current','page')
    if (tool) {
      const isSaved = saved.some(t=>t.path===tool.path)
      $('aero-save-page').setAttribute('aria-pressed',String(isSaved))
      $('aero-save-page').setAttribute('aria-label',isSaved?'Remove this tool from saved':'Save this tool')
    }
  }
  function toggleSaved(tool) {
    const exists = saved.some(t => t.path === tool.path)
    saved = exists ? saved.filter(t=>t.path!==tool.path) : [...saved,tool].slice(-100)
    let persistent = true
    try { localStorage.setItem(storageKey,JSON.stringify(saved)) } catch { persistent = false }
    notify(exists?'Removed from saved tools':persistent?'Tool saved on this device':'Saved for this visit. Device storage is unavailable.')
    syncRoute()
    if (library.open) renderLibrary()
  }
  async function getCatalog() {
    if (catalog) return catalog
    if (!catalogRequest) catalogRequest = fetch('__CATALOG_URL__').then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>catalog=data).catch(error=>{catalogRequest=null;throw error})
    return catalogRequest
  }
  function renderLibrary() {
    const query = $('aero-search').value.trim().toLowerCase()
    const source = savedOnly ? saved : catalog || []
    const matches = source.filter(t=>(activeCategory==='All'||t.category===activeCategory) && `${t.title} ${t.path} ${t.category}`.toLowerCase().includes(query))
    $('aero-result-count').textContent = `${matches.length} ${matches.length===1?'tool':'tools'}${savedOnly?' saved on this device':''}`
    $('aero-library-list').innerHTML = matches.length ? matches.map(t=>`<div class="aero-library-row"><a class="aero-library-link" href="${escape(t.path)}"><span class="aero-tool-symbol" data-kind="${escape(t.category)}">${icon(icons[t.category]||'grid')}</span><span><strong>${escape(t.title)}</strong><small>${escape(t.category)} tools</small></span></a><button class="aero-icon-button" type="button" data-save-path="${escape(t.path)}" aria-label="${saved.some(s=>s.path===t.path)?'Unsave':'Save'} ${escape(t.title)}" aria-pressed="${saved.some(s=>s.path===t.path)}">${icon('bookmark')}</button></div>`).join('') : `<p class="aero-empty">${savedOnly&&!saved.length?'Your everyday tools, one tap away.<br>Use the bookmark beside a tool to save it here.':'No tools match. Try a different name or category.'}</p>`
  }
  function showDialog(dialog) {
    lastFocus = document.activeElement
    dialog.showModal()
    document.documentElement.style.overflow = 'hidden'
  }
  for (const dialog of [library,install]) {
    dialog.addEventListener('close',()=>{document.documentElement.style.overflow='';lastFocus?.focus()})
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()}})
    dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close())
  }
  async function openLibrary(onlySaved=false) {
    savedOnly=onlySaved;activeCategory='All';$('aero-search').value=''
    $('aero-library-title').textContent=onlySaved?'Saved tools':'Find your tool'
    library.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category==='All')))
    $('aero-library-list').innerHTML='<p class="aero-empty">Loading tools…</p>'
    $('aero-result-count').textContent=''
    showDialog(library)
    // Avoid raising a phone keyboard until the user chooses to search.
    if(matchMedia('(min-width:721px)').matches) $('aero-search').focus()
    if (onlySaved) { renderLibrary(); return }
    try { await getCatalog(); if(library.open&&!savedOnly)renderLibrary() }
    catch { $('aero-library-list').innerHTML='<p class="aero-empty">The tool library could not load. <a href="/#tools">Browse tools on the homepage</a>, or try again when connected.</p>' }
  }
  document.querySelectorAll('[data-aero-tools]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();openLibrary()}))
  $('aero-nav-saved').addEventListener('click',()=>openLibrary(true))
  $('aero-save-page').addEventListener('click',()=>{const tool=currentTool();if(tool)toggleSaved(tool)})
  $('aero-search').addEventListener('input',renderLibrary)
  library.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{
    activeCategory=button.dataset.category
    library.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)))
    renderLibrary()
  }))
  $('aero-library-list').addEventListener('click',event=>{
    const button=event.target.closest('[data-save-path]')
    if (!button) return
    const tool=[...(catalog||[]),...saved].find(t=>t.path===button.dataset.savePath)
    if (tool) { toggleSaved(tool); library.querySelector(`[data-save-path="${tool.path}"]`)?.focus() }
  })
  function installed() {return matchMedia('(display-mode: standalone)').matches || navigator.standalone===true}
  function installStatus() {
    $('aero-install-now').hidden=!installPrompt||installed()
    $('aero-install-guidance').hidden=installed()
    $('aero-installed').hidden=!installed()
  }
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;installStatus()})
  window.addEventListener('appinstalled',()=>{installPrompt=null;installStatus();notify('Aeroniqx is ready on your home screen')})
  $('aero-nav-install').addEventListener('click',()=>{installStatus();showDialog(install)})
  $('aero-install-now').addEventListener('click',async()=>{
    if(!installPrompt)return
    try {const prompt=installPrompt;installPrompt=null;await prompt.prompt();await prompt.userChoice} catch {notify('Use your browser menu to add Aeroniqx to your home screen.')}
    installStatus()
  })
  function networkStatus() {$('aero-offline').dataset.offline=String(!navigator.onLine)}
  window.addEventListener('online',networkStatus);window.addEventListener('offline',networkStatus);networkStatus()
  $('aero-nav-saved').disabled=false;$('aero-nav-install').disabled=false
  syncRoute()
  window.addEventListener('popstate',syncRoute)
  const root=document.getElementById('root')
  if(root)new MutationObserver(()=>{if(lastPath!==location.pathname)syncRoute()}).observe(root,{childList:true,subtree:true})
  if('serviceWorker' in navigator && window.top===window) {
    const register=()=>navigator.serviceWorker.register('/service-worker.js',{updateViaCache:'none'}).catch(()=>{})
    if(document.readyState==='complete')register();else window.addEventListener('load',register,{once:true})
  }
})()
