import { readFile, writeFile, readdir, mkdir, cp } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { categories } from './tool-content.mjs'
import { writePlatformPages } from './platform-pages.mjs'
import { buildToolCatalog } from './tool-catalog.mjs'

const hash = text => createHash('sha256').update(text).digest('hex').slice(0,12)
const escape = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const decode = text => text.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim()
const glyphs = {
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  bookmark:'<path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4z"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M5 16v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  back:'<path d="m14 5-7 7 7 7M7 12h14"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
  file:'<path d="M14 3H5v18h14V8zM14 3v6h5M8 13h8M8 17h5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
  calculator:'<rect x="5" y="2" width="14" height="20" rx="3"/><path d="M8 6h8M8 11h1m6 0h1M8 15h1m6 0h1M8 19h1m6 0h1"/>',
  pen:'<path d="m15 4 5 5M4 20l5-1L21 7l-4-4L5 15zM3 22h18"/>',
  folder:'<path d="M3 7V5a1 1 0 0 1 1-1h5l3 3h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>'
}
const icon = name => `<svg class="aero-icon" aria-hidden="true"><use href="#aero-symbol-${name}"></use></svg>`

function shell(current, name) {
  const isTool = !['/','/tools/','/guides/','/about/','/privacy/','/offline/'].includes(current)&&!current.startsWith('/how-to-')
  return `<svg width="0" height="0" aria-hidden="true" style="position:absolute;overflow:hidden">${Object.entries(glyphs).map(([name,paths])=>`<symbol id="aero-symbol-${name}" viewBox="0 0 24 24">${paths}</symbol>`).join('')}</svg>
<header class="aero-app-header" aria-label="Aeroniqx app">
  <a href="/" id="aero-back" class="aero-icon-button" aria-label="Back to all tools"${isTool?'':' hidden'}>${icon('back')}</a>
  <a href="/" id="aero-brand" class="aero-app-brand"${isTool?' hidden':''}><img src="/assets/app-icons/icon-192.png" width="32" height="32" alt="">Aeroniqx</a>
  <span id="aero-page-name" class="aero-app-page-name"${isTool?'':' hidden'}>${escape(name)}</span>
  <span id="aero-home-label" class="aero-home-label"${isTool?' hidden':''}>Free · No ads</span>
  <button id="aero-save-page" class="aero-icon-button" type="button" aria-label="Save this tool" aria-pressed="false"${isTool?'':' hidden'}>${icon('bookmark')}</button>
</header>
<div id="aero-offline" class="aero-offline-note" role="status">You’re offline. Work Hours and Bill Splitter are available once their app files are saved.</div>`
}

function controls(isHome) {
  return `<nav class="aero-app-nav" aria-label="App navigation">
<a href="/" id="aero-nav-home"${isHome?' aria-current="page"':''}>${icon('home')}<span>Home</span></a>
<a href="/tools/" data-aero-tools>${icon('grid')}<span>Tools</span></a>
<button type="button" id="aero-nav-saved" disabled>${icon('bookmark')}<span>Saved</span></button>
<button type="button" id="aero-nav-install" disabled>${icon('download')}<span>Get app</span></button>
</nav>
<dialog id="aero-library" class="aero-dialog" aria-labelledby="aero-library-title">
 <div class="aero-dialog-head"><h2 id="aero-library-title">Find your tool</h2><button type="button" class="aero-icon-button" data-close aria-label="Close tool library" autofocus>${icon('close')}</button></div>
 <div class="aero-dialog-controls"><label class="aero-search">${icon('search')}<input id="aero-search" type="search" aria-label="Search tools" placeholder="Search a tool or task…" autocomplete="off" enterkeyhint="search" autocapitalize="none" spellcheck="false"></label>
 <div class="aero-chips" role="group" aria-label="Tool category">${[{id:'All',label:'All'},...categories].map(c=>`<button type="button" class="aero-chip" data-category="${c.id}" aria-pressed="${c.id==='All'}">${c.label}</button>`).join('')}</div>
 <p id="aero-result-count" class="aero-results-note" role="status" aria-live="polite"></p></div>
 <div id="aero-library-list" class="aero-library-list"></div>
 <div class="aero-library-footer"><a href="/guides/">Guides &amp; Presets <span aria-hidden="true">↗</span></a></div>
</dialog>
<dialog id="aero-install" class="aero-dialog" aria-labelledby="aero-install-title">
 <div class="aero-dialog-head"><h2 id="aero-install-title">Your toolkit. One tap away.</h2><button type="button" class="aero-icon-button" data-close aria-label="Close installation help" autofocus>${icon('close')}</button></div>
 <div class="aero-install-body"><img class="aero-install-brand" src="/assets/app-icons/icon-192.png" alt="" width="64" height="64"><p>Add Aeroniqx to your home screen and open your tools in their own app window. Free, with no account or app store download.</p>
 <button type="button" class="aero-install-button" id="aero-install-now" hidden>Install Aeroniqx</button>
 <p id="aero-installed" hidden>Aeroniqx is already running as an app on this device.</p>
 <div id="aero-install-guidance"><h3>On iPhone or iPad</h3><ol><li>Open Aeroniqx in Safari and tap <strong>Share</strong>.</li><li>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li></ol><h3>On Android</h3><p>Open your browser menu (⋮), then choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. The option depends on your browser.</p></div>
 <p class="aero-local-note">Saved tools stay on this device. Work Hours can open offline after a connected visit; other tools may need an internet connection. Your files and timesheet entries are never stored by the app’s offline cache.</p></div>
</dialog>
<div id="aero-toast" class="aero-toast" role="status" aria-live="polite" hidden></div>`
}

export async function addMobileApp(root, dist, { calculatorAssets, billSplitterAssets, updatesCss }) {
  const source=path.join(root,'tools/app-shell')
  await mkdir(path.join(dist,'assets/app-icons'),{recursive:true})
  for(const file of ['icon-192.png','icon-512.png','maskable-512.png','apple-touch-icon.png'])await cp(path.join(source,file),path.join(dist,'assets/app-icons',file))
  const pages=(await readdir(dist,{recursive:true})).map(f=>f.replaceAll('\\','/')).filter(f=>f.endsWith('.html')&&f!=='404.html').sort()
  const toolPages=[]
  for(const file of pages){
    const url='/'+file.replaceAll('\\','/').replace(/index\.html$/,'')
    if(['/','/about/','/privacy/'].includes(url))continue
    const html=await readFile(path.join(dist,file),'utf8')
    const h1=html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1]
    if(h1)toolPages.push({path:url,title:decode(h1).split(' — ')[0].replace(/\s+Online(?: Free)?$/,''),html})
  }
  const { catalog, resources }=buildToolCatalog(toolPages)
  const catalogText=JSON.stringify(catalog),catalogFile=`assets/app-catalog-${hash(catalogText)}.json`
  await writeFile(path.join(dist,catalogFile),catalogText)
  const css=(await readFile(path.join(source,'app.css'),'utf8'))+'\n'+await readFile(path.join(source,'platform.css'),'utf8'),cssFile=`assets/mobile-app-${hash(css)}.css`
  const searchHelpers=(await readFile(path.join(source,'search.js'),'utf8')).replace(/^export /gm,'')
  const js=(await readFile(path.join(source,'app.js'),'utf8')).replace('/* SEARCH_HELPERS */',searchHelpers).replace('__CATALOG_URL__','/'+catalogFile),jsFile=`assets/mobile-app-${hash(js)}.js`
  await writeFile(path.join(dist,cssFile),css);await writeFile(path.join(dist,jsFile),js)
  const manifest={id:'/',name:'Aeroniqx — Everyday Tools',short_name:'Aeroniqx',description:'Useful tools for work, money, documents and creative tasks. Free to use, with no ads or Aeroniqx account.',start_url:'/',scope:'/',display:'standalone',background_color:'#ffffff',theme_color:'#ffffff',lang:'en',icons:[{src:'/assets/app-icons/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/assets/app-icons/icon-512.png',sizes:'512x512',type:'image/png'},{src:'/assets/app-icons/maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}],shortcuts:[{name:'All tools',url:'/tools/'},{name:'Work Hours & Timesheet',short_name:'Work Hours',url:'/work-hours-calculator/'},{name:'Handwriting Font',url:'/handwriting-font/'}]}
  await writeFile(path.join(dist,'manifest.webmanifest'),JSON.stringify(manifest,null,2)+'\n')
  await writePlatformPages(dist,catalog,resources)
  pages.push('tools/index.html','guides/index.html')
  for(const file of pages){
    const url='/'+file.replaceAll('\\','/').replace(/index\.html$/,'')
    let html=await readFile(path.join(dist,file),'utf8')
    const title=catalog.find(t=>t.path===url)?.title||resources.find(t=>t.path===url)?.title||'Aeroniqx'
    html=html.replace(/<meta\b[^>]*name="(?:theme-color|apple-mobile-web-app-capable|apple-mobile-web-app-title)"[^>]*>/gi,'')
      .replace(/(<meta[^>]*name="viewport"[^>]*content=")([^"]*)"/,(_,prefix,value)=>`${prefix}${value.replace(/,?\s*viewport-fit=[^,]+/,'')}, viewport-fit=cover, interactive-widget=resizes-content"`)
      .replace('</head>',`<meta name="theme-color" content="#ffffff"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Aeroniqx"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/assets/app-icons/apple-touch-icon.png"><link rel="stylesheet" href="/${cssFile}"><script src="/${jsFile}" defer></script>\n</head>`)
      .replace(/<body([^>]*)>/,(_,attrs)=>`<body${attrs}>${shell(url,title)}`)
      .replace('</body>',controls(url==='/')+'\n</body>')
    await writeFile(path.join(dist,file),html)
  }
  await mkdir(path.join(dist,'offline'),{recursive:true})
  await writeFile(path.join(dist,'offline/index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="theme-color" content="#ffffff"><title>You’re offline | Aeroniqx</title><style>body{font:16px/1.7 system-ui;background:#f5f7fb;color:#17304e;margin:0;min-height:100vh;display:grid;place-items:center}main{padding:32px;max-width:420px}img{border-radius:20px}h1{font-size:2rem;letter-spacing:-.04em}a{display:block;padding:13px 18px;border-radius:14px;background:#1557b0;color:white;text-align:center;text-decoration:none;margin:12px 0}p{color:#536175}</style></head><body><main><img src="/assets/app-icons/icon-192.png" alt="" width="72" height="72"><h1>You’re offline.</h1><p>This tool needs a connection to open. You can still use Work Hours and Bill Splitter if their app files finished saving during a connected visit.</p><a href="/bill-splitter/">Open Bill Splitter</a><a href="/work-hours-calculator/">Open Work Hours</a><a href="/">Back to your tools</a></main></body></html>`)
  const assets=[cssFile,jsFile,catalogFile,'manifest.webmanifest',...['icon-192.png','icon-512.png','maskable-512.png','apple-touch-icon.png'].map(f=>'assets/app-icons/'+f)]
  const precache=['/','/work-hours-calculator/','/bill-splitter/','/offline/',...assets.map(f=>'/'+f),'/assets/index-DB-gONZg.css','/'+updatesCss,...calculatorAssets.map(f=>'/'+f),...billSplitterAssets.map(f=>'/'+f)]
  const workerTemplate=await readFile(path.join(source,'service-worker.js'),'utf8')
  const version=hash(workerTemplate+(await Promise.all(precache.map(url=>readFile(path.join(dist,url.endsWith('/')?url.slice(1)+'index.html':url.slice(1)))))).map(b=>hash(b)).join(''))
  await writeFile(path.join(dist,'service-worker.js'),workerTemplate.replace('__VERSION__',version).replace('__PRECACHE__',JSON.stringify(precache)))
  return {assets:[...assets,'service-worker.js','offline/index.html'],script:jsFile,catalog:catalogFile,version,tools:catalog.length,resources:resources.length}
}
