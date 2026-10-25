import {cleanEvent,TOOLS} from './schema.js'

const TARGET_SHEET='16D7X2W3WBSJHVFMzuZvguuw3C5iUhvuQcKXl_FRcRnM'
const VERSION='aeroniqx-events-v2'
const MAX_ROWS=100000
export const HEADERS={
  events_v2:['event_id','timestamp','event_type','tool','action','path','file_type','error_code','country','device','browser','app_mode','referrer','session_id','received_at','source'],
  page_views:['timestamp','path','referrer','country','device','browser','session_id'],
  tool_uses:['timestamp','tool','action','country','session_id'],
  downloads:['timestamp','tool','file_type','file_size_kb','country','session_id'],
  errors:['timestamp','tool','error','path','country','session_id']
}
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}})
const queueFor=env=>env.EVENT_QUEUE.get(env.EVENT_QUEUE.idFromName('aeroniqx-events-v2'))
export async function legacyEvent(input,country='XX',stableKey='') {
  if(!input||!['page_view','tool_use','download','error'].includes(input.event_type))return null
  const id=async value=>{
    const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))
    bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128
    const h=[...bytes.slice(0,16)].map(b=>b.toString(16).padStart(2,'0')).join('')
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`
  }
  const type={tool_use:'tool_start',error:'tool_error'}[input.event_type]||input.event_type
  const event=cleanEvent({event_type:type,event_id:stableKey?await id(stableKey):crypto.randomUUID(),session_id:await id(String(input.session_id||crypto.randomUUID())),timestamp:input.timestamp||new Date().toISOString(),path:input.path||`/${input.tool||''}/`,tool:input.tool,
    action:input.action==='render-text'?'render':input.action==='start'?'copy':input.action,file_type:input.file_type,error_code:type==='tool_error'?'processing_failed':'',device:input.device,browser:input.browser,referrer:'other'})
  return event?{...event,country,received_at:new Date().toISOString(),source:'legacy'}:null
}
export async function boundedBody(request) {
  if(Number(request.headers.get('Content-Length'))>20000)throw Error('too_large')
  if(!request.body)throw Error('invalid_json')
  const reader=request.body.getReader(),chunks=[];let total=0
  try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>20000)throw Error('too_large');chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  return JSON.parse(new TextDecoder().decode(bytes))
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url),origin=request.headers.get('Origin')||''
    if(url.pathname==='/health'&&request.method==='GET')return queueFor(env).fetch('https://queue/health')
    const allowed=['https://aeroniqx.in','https://www.aeroniqx.in']
    if(!allowed.includes(origin))return json({error:'origin_not_allowed'},403)
    const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'}
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors})
    if(!['/track','/v2/track'].includes(url.pathname)||request.method!=='POST')return json({error:'not_found'},404,cors)
    if(request.headers.get('DNT')==='1'||request.headers.get('Sec-GPC')==='1')return new Response(null,{status:204,headers:cors})
    let body;try{body=await boundedBody(request)}catch{return json({error:'invalid_payload'},400,cors)}
    if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'invalid_payload'},400,cors)
    const country=/^[A-Z]{2}$/.test(request.cf?.country||'')?request.cf.country:'XX'
    let events
    if(url.pathname==='/track')events=[await legacyEvent(body,country)].filter(Boolean)
    else{
      if(body.version!==2||!Array.isArray(body.events)||!body.events.length||body.events.length>20)return json({error:'invalid_batch'},400,cors)
      events=body.events.map(e=>cleanEvent(e)).filter(Boolean).map(e=>({...e,country,received_at:new Date().toISOString(),source:body.test===true?'verification':'live'}))
      if(events.length!==body.events.length)return json({error:'invalid_event'},400,cors)
    }
    if(!events.length)return json({error:'invalid_event'},400,cors)
    try{
      const response=await queueFor(env).fetch('https://queue/enqueue',{method:'POST',body:JSON.stringify(events)})
      return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}})
    }catch{return json({error:'temporarily_unavailable'},503,cors)}
  },
  async scheduled(controller,env,ctx){ctx.waitUntil(queueFor(env).fetch('https://queue/flush',{method:'POST'}).then(response=>{if(!response.ok)throw Error('Analytics flush needs attention')}))}
}

// A single SQLite Durable Object serializes collection and delivery. Each batch
// is assigned fixed sheet ranges BEFORE the network write. A retry writes the
// same rows, including after an ambiguous Google timeout; it never appends twice.
export class EventQueue {
  constructor(state,env){
    this.state=state;this.env=env;this.sql=state.storage.sql;this.flushing=null;this.token=null
    this.sql.exec('CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, payload TEXT NOT NULL, received INTEGER NOT NULL, delivered INTEGER NOT NULL DEFAULT 0)')
    this.sql.exec('CREATE INDEX IF NOT EXISTS pending_events ON events(delivered,received)')
    this.sql.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    this.sql.exec('CREATE TABLE IF NOT EXISTS delivery (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL, ids TEXT NOT NULL)')
  }
  get(key){return [...this.sql.exec('SELECT value FROM meta WHERE key=?',key)][0]?.value}
  set(key,value){this.sql.exec('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,String(value))}
  pending(){return [...this.sql.exec('SELECT COUNT(*) AS n FROM events WHERE delivered=0')][0].n}
  enqueue(events){
    if(this.pending()+events.length>10000)return json({error:'queue_capacity'},503)
    let accepted=0
    this.state.storage.transactionSync(()=>{for(const e of events){if([...this.sql.exec('SELECT id FROM events WHERE id=?',e.event_id)].length)continue;this.sql.exec('INSERT INTO events(id,payload,received) VALUES(?,?,?)',e.event_id,JSON.stringify(e),Date.now());accepted++}})
    return json({ok:true,accepted},202)
  }
  async fetch(request){
    const route=new URL(request.url).pathname
    if(route==='/health')return json({ok:!this.get('last_error'),version:VERSION,initialized:this.get('initialized')==='2',pending:this.pending(),last_delivery:this.get('last_delivery')||null,error:this.get('last_error')||null,configured:this.env.SHEET_ID===TARGET_SHEET})
    if(route==='/enqueue'&&request.method==='POST')return this.enqueue(await request.json())
    if(route==='/flush'&&request.method==='POST'){
      if(!this.flushing)this.flushing=this.flush().finally(()=>{this.flushing=null})
      try{await this.flushing;return json({ok:true})}catch(error){this.set('last_error',error.code||'delivery_failed');return json({error:'delivery_failed'},503)}
    }
    return json({error:'not_found'},404)
  }
  async sheet(method,suffix,body){
    if(this.env.SHEET_ID!==TARGET_SHEET)throw Object.assign(Error('Wrong spreadsheet'),{code:'sheet_configuration'})
    const token=await this.googleToken()
    const response=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${TARGET_SHEET}${suffix}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)})
    if(!response.ok){if(response.status===401)this.token=null;throw Object.assign(Error('Sheet request failed'),{code:'sheets_'+response.status})}
    return response.json()
  }
  async googleToken(){
    if(this.token&&Date.now()<this.token.expires)return this.token.value
    const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
    const encode=value=>b64(new TextEncoder().encode(JSON.stringify(value)))
    const now=Math.floor(Date.now()/1000),input=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:this.env.SHEETS_CLIENT_EMAIL,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})
    const pem=this.env.SHEETS_PRIVATE_KEY.replace(/\\n/g,'\n').replace(/-----[^-]+-----|\s/g,'')
    const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign'])
    const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(input))
    const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:input+'.'+b64(new Uint8Array(signature))}),signal:AbortSignal.timeout(15000)})
    const result=await response.json()
    if(!response.ok||!result.access_token)throw Object.assign(Error('Google authentication failed'),{code:'google_auth'})
    this.token={value:result.access_token,expires:Date.now()+3300000};return this.token.value
  }
  async initialize(){
    if(this.get('initialized')==='2')return
    let metadata=await this.sheet('GET','?fields=sheets.properties')
    const titles=metadata.sheets.map(s=>s.properties.title),missing=[...Object.keys(HEADERS),'analytics_summary'].filter(title=>!titles.includes(title))
    if(missing.length){
      await this.sheet('POST',':batchUpdate',{requests:missing.map(title=>({addSheet:{properties:{title,gridProperties:{rowCount:1000,columnCount:20,frozenRowCount:1}}}}))})
      metadata=await this.sheet('GET','?fields=sheets.properties')
    }
    const data=[]
    for(const [tab,headers] of Object.entries(HEADERS)){
      const existing=await this.sheet('GET','/values/'+encodeURIComponent(`${tab}!A1:T1`))
      if(existing.values?.length&&headers.some((h,i)=>existing.values[0][i]!==h))throw Object.assign(Error('Header mismatch'),{code:'sheet_headers'})
      if(!existing.values?.length)data.push({range:`${tab}!A1`,values:[headers]})
      const gridRows=metadata.sheets.find(s=>s.properties.title===tab).properties.gridProperties.rowCount
      if(gridRows>MAX_ROWS)throw Object.assign(Error('Review existing sheet capacity'),{code:'sheet_capacity'})
      const rows=await this.sheet('GET','/values/'+encodeURIComponent(`${tab}!A1:A${gridRows}`))
      this.set('row_'+tab,Math.max(2,(rows.values?.length||1)+1))
    }
    if(missing.includes('analytics_summary'))data.push({range:'analytics_summary!A1',values:summaryRows()})
    if(data.length)await this.sheet('POST','/values:batchUpdate',{valueInputOption:'USER_ENTERED',data})
    const formats=[]
    for(const title of missing){
      const sheetId=metadata.sheets.find(s=>s.properties.title===title).properties.sheetId
      const summary=title==='analytics_summary'
      formats.push({repeatCell:{range:{sheetId,startRowIndex:0,endRowIndex:1},cell:{userEnteredFormat:{backgroundColor:{red:0.1,green:0.2,blue:0.34},textFormat:{bold:true,foregroundColor:{red:1,green:1,blue:1}}}},fields:'userEnteredFormat'}})
      if(summary){
        formats.push({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:0,endIndex:1},properties:{pixelSize:260},fields:'pixelSize'}},{updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:1,endIndex:2},properties:{pixelSize:550},fields:'pixelSize'}},{updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:2,endIndex:3},properties:{pixelSize:150},fields:'pixelSize'}},{repeatCell:{range:{sheetId,startRowIndex:1,endRowIndex:summaryRows().length,startColumnIndex:0,endColumnIndex:3},cell:{userEnteredFormat:{wrapStrategy:'WRAP',verticalAlignment:'MIDDLE'}},fields:'userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment'}},{autoResizeDimensions:{dimensions:{sheetId,dimension:'ROWS',startIndex:0,endIndex:summaryRows().length}}})
      }else{
        formats.push({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:0,endIndex:HEADERS[title].length},properties:{pixelSize:165},fields:'pixelSize'}})
      }
    }
    if(formats.length)await this.sheet('POST',':batchUpdate',{requests:formats})
    this.set('initialized','2')
  }
  async migrateLegacy(){
    // Leave the previous buffer intact for recovery. Stable IDs make this read
    // idempotent; the old deployment's own one-hour TTL eventually expires it.
    if(!this.env.ANALYTICS_BUFFER)return
    const raw=await this.env.ANALYTICS_BUFFER.get('event_buffer')
    if(!raw||raw==='[]')return
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(b=>b.toString(16).padStart(2,'0')).join('')
    if(this.get('legacy_hash')===hash)return
    let entries;try{entries=JSON.parse(raw)}catch{return}
    if(!Array.isArray(entries)||entries.length>1000)return
    const events=[]
    for(const [i,entry] of entries.entries()){
      const event=await legacyEvent({event_type:entry.event_type,...entry.data},/^[A-Z]{2}$/.test(entry.data?.country)?entry.data.country:'XX','legacy:'+i+':'+JSON.stringify(entry))
      if(event)events.push(event)
    }
    if(events.length){const response=this.enqueue(events);if(!response.ok)throw Error('Migration queue full')}
    this.set('legacy_hash',hash)
  }
  async flush(){
    await this.migrateLegacy()
    await this.initialize()
    for(let pass=0;pass<3;pass++){
      let job=[...this.sql.exec('SELECT body,ids FROM delivery WHERE id=1')][0]
      if(!job){
        const pending=[...this.sql.exec('SELECT id,payload FROM events WHERE delivered=0 ORDER BY received,id LIMIT 200')]
        if(!pending.length)break
        const grouped=groupRows(pending.map(row=>JSON.parse(row.payload))),data=[]
        this.state.storage.transactionSync(()=>{
          for(const [tab,values] of Object.entries(grouped)){
            const row=Number(this.get('row_'+tab))
            if(row+values.length-1>MAX_ROWS)throw Object.assign(Error('Archive sheet before collecting more'),{code:'sheet_capacity'})
            data.push({range:`${tab}!A${row}`,values});this.set('row_'+tab,row+values.length)
          }
          job={body:JSON.stringify({valueInputOption:'RAW',data}),ids:JSON.stringify(pending.map(row=>row.id))}
          this.sql.exec('INSERT INTO delivery(id,body,ids) VALUES(1,?,?)',job.body,job.ids)
        })
      }
      const body=JSON.parse(job.body)
      // Grow only the managed sheets, without inserting or shifting existing rows.
      const metadata=await this.sheet('GET','?fields=sheets.properties')
      const requests=[]
      for(const entry of body.data){const [title,start]=entry.range.split('!A'),needed=Number(start)+entry.values.length-1,props=metadata.sheets.find(s=>s.properties.title===title).properties;if(needed>props.gridProperties.rowCount)requests.push({appendDimension:{sheetId:props.sheetId,dimension:'ROWS',length:Math.max(1000,needed-props.gridProperties.rowCount)}})}
      if(requests.length)await this.sheet('POST',':batchUpdate',{requests})
      await this.sheet('POST','/values:batchUpdate',body)
      this.state.storage.transactionSync(()=>{for(const id of JSON.parse(job.ids))this.sql.exec('UPDATE events SET delivered=1 WHERE id=?',id);this.sql.exec('DELETE FROM delivery WHERE id=1');this.set('last_delivery',new Date().toISOString());this.set('last_error','')})
    }
    this.sql.exec('DELETE FROM events WHERE delivered=1 AND received<?',Date.now()-7*86400000)
    this.set('last_error','')
  }
}
export function groupRows(events){
  const grouped={events_v2:events.map(e=>HEADERS.events_v2.map(key=>e[key]||''))}
  for(const e of events){
    if(e.source==='verification')continue
    let tab,data=e
    if(e.event_type==='page_view')tab='page_views'
    else if(e.event_type==='download')tab='downloads'
    else if(e.event_type==='tool_error'){tab='errors';data={...e,error:e.error_code||'processing_failed'}}
    else{tab='tool_uses';data={...e,tool:e.tool||'platform',action:e.event_type+(e.action?':'+e.action:'')}}
    ;(grouped[tab]||=[]).push(HEADERS[tab].map(key=>data[key]||''))
  }
  return grouped
}
export function summaryRows(){
  const count=type=>`=COUNTIFS(events_v2!C2:C,"${type}",events_v2!P2:P,"<>verification")`
  return [['Aeroniqx event collection','Live metrics from events_v2'],['Page views',count('page_view')],['Tool starts',count('tool_start')],['Successful results',count('tool_success')],['Tool errors',count('tool_error')],['Downloads initiated',count('download')],['Native shares completed',count('share_complete')],['Share cancelled',count('share_cancel')],['Search opened',count('search_open')],['Search result selected',count('search_select')],['App installations',count('app_install')],['Notes','Downloads mean browser initiation; shares do not confirm recipient delivery.'],['Privacy','No files, filenames, search text, input values, IP addresses or full referrer URLs.'],['Raw data','Keep raw tabs in place. Use filter views; do not insert, sort or delete managed rows.'],['Tool','Starts','Successful results'],...TOOLS.map(tool=>[tool,`=COUNTIFS(events_v2!D2:D,A${16+TOOLS.indexOf(tool)},events_v2!C2:C,"tool_start",events_v2!P2:P,"<>verification")`,`=COUNTIFS(events_v2!D2:D,A${16+TOOLS.indexOf(tool)},events_v2!C2:C,"tool_success",events_v2!P2:P,"<>verification")`]),['Coverage','Auto-updating finance tools record interactions; they do not count preset defaults as successful uses.'],['Capacity','100,000 managed rows per tab. The collector reports sheet_capacity and retains pending events if reached.'],['Delivery','Normally about one minute. Browser blockers, offline visits and platform quotas can cause undercounting.'],['History','Old rows remain in the original tabs; summary metrics start with this release.']]
}
