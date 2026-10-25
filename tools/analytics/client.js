// Only the explicitly listed event fields leave the browser. No input values,
// searches, filenames, result contents, query strings or raw error messages.
export function installAnalytics() {
  const endpoint='https://aero-analytics.techazzer.workers.dev/v2/track'
  const preference='aeroniqx.analytics.optout',sessionKey='aeroniqx.analytics.session.v2'
  let queue=[],timer,busy=false,lastPath='',sent=0,memorySession=null
  const once=new Set()
  function disabled() {
    if(!['aeroniqx.in','www.aeroniqx.in'].includes(location.hostname))return true
    if(navigator.globalPrivacyControl===true||navigator.doNotTrack==='1')return true
    try {if(localStorage.getItem(preference)==='1')return true}catch{}
    if(window.top!==window.self){try{if(new URL(document.referrer).origin!==location.origin)return true}catch{return true}}
    return false
  }
  function session() {
    const now=Date.now()
    let saved=memorySession
    try{saved=JSON.parse(sessionStorage.getItem(sessionKey))||saved}catch{}
    if(!saved||typeof saved.id!=='string'||now-saved.last>1800000)saved={id:crypto.randomUUID(),last:now}
    saved.last=now;memorySession=saved
    try{sessionStorage.setItem(sessionKey,JSON.stringify(saved))}catch{}
    return saved.id
  }
  function referrer() {
    if(!document.referrer)return 'direct'
    try{
      const host=new URL(document.referrer).hostname
      if(host===location.hostname)return 'internal'
      if(/(^|\.)google\.[a-z.]+$/.test(host))return 'google'
      if(/(^|\.)bing\.com$/.test(host))return 'bing'
      if(/(^|\.)duckduckgo\.com$/.test(host))return 'duckduckgo'
      if(/(^|\.)yahoo\.[a-z.]+$/.test(host))return 'yahoo'
      if(/(^|\.)(facebook|instagram|linkedin|reddit|pinterest|t|x|whatsapp)\.(com|co)$/.test(host))return 'social'
    }catch{}
    return 'other'
  }
  function browserType(){const ua=navigator.userAgent;return /Edg\//.test(ua)?'Edge':/Firefox\//.test(ua)?'Firefox':/Chrome\/|CriOS\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':'Other'}
  async function flush() {
    clearTimeout(timer)
    if(disabled()){queue=[];return}
    if(busy||!queue.length||!navigator.onLine)return
    busy=true
    const batch=queue.splice(0,20)
    try{
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({version:2,events:batch.map(item=>item.event)}),credentials:'omit',referrerPolicy:'no-referrer',keepalive:true,signal:AbortSignal.timeout(12000)})
      if(!response.ok)throw Error('Collector unavailable')
    }catch{for(const item of batch)if(item.attempt++<2)queue.push(item)}
    finally{busy=false;if(queue.length)timer=setTimeout(flush,10000)}
  }
  function track(event_type,detail={},options={}) {
    try{
      if(disabled()||sent>=180)return
      const path=safePath(location.pathname),key=path+'|'+event_type+'|'+(detail.tool||'')+'|'+(detail.action||'')
      if(options.once&&once.has(key))return
      const event=cleanEvent({...detail,event_type,event_id:crypto.randomUUID(),session_id:session(),timestamp:new Date().toISOString(),path,
        device:innerWidth<=720?'mobile':innerWidth<=1100?'tablet':'desktop',browser:browserType(),app_mode:matchMedia('(display-mode: standalone)').matches||navigator.standalone===true?'standalone':'browser',referrer:referrer()})
      if(!event)return
      if(options.once)once.add(key)
      if(queue.length>=60)return
      queue.push({event,attempt:0});sent++
      clearTimeout(timer);timer=setTimeout(flush,queue.length>=20?0:3000)
    }catch{/* Measurement must never interrupt a tool. */}
  }
  window.aeroTrack=track
  window.aeroAnalytics={route(){const path=safePath(location.pathname);if(path===lastPath)return;lastPath=path;once.clear();if(window.top===window.self)track('page_view')},flush}
  window.aeroAnalytics.route()
  window.addEventListener('popstate',()=>window.aeroAnalytics.route())
  window.addEventListener('online',flush)
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush()})
  window.addEventListener('pagehide',flush)
  document.addEventListener('change',event=>{
    if(event.target.closest('.calc-page')&&event.target.matches('input,select'))track('tool_interaction',{action:'calculate'},{once:true})
  })
  const choice=document.getElementById('analytics-optout')
  if(choice){
    try{choice.checked=localStorage.getItem(preference)==='1'}catch{}
    const status=document.getElementById('analytics-status')
    const explain=()=>{status.textContent=disabled()?'Usage measurement is off in this browser.':'Basic usage measurement is on. Your files and entered values are excluded.'}
    explain()
    choice.addEventListener('change',()=>{try{localStorage.setItem(preference,choice.checked?'1':'0');if(choice.checked){queue=[];clearTimeout(timer);sessionStorage.removeItem(sessionKey);memorySession=null}explain()}catch{status.textContent='Your browser could not save this preference. Browser Do Not Track and Global Privacy Control are also respected.'}})
  }
}
