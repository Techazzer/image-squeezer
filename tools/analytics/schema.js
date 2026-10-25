export const TOOLS = ['bill-splitter','work-hours-calculator','image-compressor','pdf-compress','pdf-merge','pdf-split','pdf-to-images','images-to-pdf','handwriting-font','drive-folder-copy','emi-calculator','gst-calculator','sip-calculator','salary-calculator']
export const EVENTS = ['page_view','tool_start','tool_success','tool_error','tool_interaction','download','share_open','share_complete','share_cancel','share_fallback','search_open','search_select','tool_save','app_install']
export const ACTIONS = ['','compress','merge','split','convert','calculate','quick','group','copy','render','generate','preview','template','backup','result','print','native','whatsapp','file','save','unsave','browse','search','edit','start']
export const FORMATS = ['','pdf','jpg','png','webp','zip','csv','json','ttf']
export const ERROR_CODES = ['','invalid_input','processing_failed','service_unavailable','share_unavailable','restore_failed']
export function safePath(value) {
  const path=String(value||'/').split(/[?#]/)[0].replace(/\/?$/,'/')
  return /^\/(?:[a-z0-9-]+\/){0,3}$/.test(path)&&path.length<=100?path:'/other/'
}
export function toolForPath(value) {
  const path=safePath(value),exact=TOOLS.find(tool=>path===`/${tool}/`)
  if(exact)return exact
  if(/(?:compress-pdf|pdf-compress)/.test(path))return 'pdf-compress'
  if(/(?:compress-image|image-compress|resize-image|passport-photo|signature|photo-resize|image-resiz)/.test(path))return 'image-compressor'
  return ''
}
export function cleanEvent(input, now=Date.now()) {
  if(!input||!EVENTS.includes(input.event_type))return null
  const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
  if(!uuid.test(input.event_id||'')||!uuid.test(input.session_id||''))return null
  const time=Date.parse(input.timestamp)
  if(!Number.isFinite(time)||Math.abs(now-time)>86400000)return null
  const path=safePath(input.path),tool=TOOLS.includes(input.tool)?input.tool:toolForPath(path)
  if(['tool_start','tool_success','tool_error','tool_interaction','download','share_open','share_complete','share_cancel','share_fallback','tool_save'].includes(input.event_type)&&!tool)return null
  return {event_id:input.event_id,session_id:input.session_id,timestamp:new Date(time).toISOString(),event_type:input.event_type,path,tool,
    action:ACTIONS.includes(input.action)?input.action:'',file_type:FORMATS.includes(input.file_type)?input.file_type:'',error_code:ERROR_CODES.includes(input.error_code)?input.error_code:'',
    device:['mobile','tablet','desktop'].includes(input.device)?input.device:'desktop',browser:['Chrome','Edge','Firefox','Safari','Other'].includes(input.browser)?input.browser:'Other',
    app_mode:input.app_mode==='standalone'?'standalone':'browser',referrer:['direct','internal','google','bing','duckduckgo','yahoo','social','other'].includes(input.referrer)?input.referrer:'other'}
}
