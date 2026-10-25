const CACHE = 'aeroniqx-app-__VERSION__'
const PRECACHE = __PRECACHE__
const OFFLINE = '/offline/'
const DOCUMENTS = new Set(['/', '/work-hours-calculator/'])
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE)))
  // Activate updates after existing tabs close; never reload an in-progress tool.
})
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('aeroniqx-app-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))
})
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url)
  if(request.method!=='GET'||url.origin!==self.location.origin)return
  if(request.mode==='navigate') {
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE)
      try {
        // Keep offline HTML paired with this worker's precached asset versions.
        // A newer deployment may be online while its worker is still waiting.
        return await fetch(request)
      } catch {
        return (DOCUMENTS.has(url.pathname)&&!url.search?await cache.match(url.pathname):null)||await cache.match(OFFLINE)||Response.error()
      }
    })())
  } else if(PRECACHE.includes(url.pathname)&&!url.search) {
    event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.pathname))||fetch(request)))
  }
})
