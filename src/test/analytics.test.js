import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import worker,{EventQueue,groupRows,legacyEvent,boundedBody} from '../../tools/analytics/worker.js'
import {cleanEvent,safePath} from '../../tools/analytics/schema.js'
import {instrumentLegacyEvents} from '../../scripts/analytics-integration.mjs'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
const input=(extra={})=>({event_type:'tool_success',event_id:crypto.randomUUID(),session_id:crypto.randomUUID(),timestamp:new Date().toISOString(),path:'/bill-splitter/?name=private#secret',tool:'bill-splitter',action:'quick',...extra})
test('analytics allowlist excludes files, names, values, searches and raw errors',()=>{
 const event=cleanEvent(input({name:'Private Name',amount:123,file_name:'secret.pdf',query:'sensitive search',error:'private message',referrer:'https://example.com/private?token=123'}))
 assert.equal(event.path,'/bill-splitter/');assert.equal(event.referrer,'other')
 assert.doesNotMatch(JSON.stringify(event),/Private|secret|sensitive|private message|example\.com/)
 for(const key of ['name','amount','file_name','query','error'])assert.equal(key in event,false)
 assert.equal(safePath('/bad@example/'),'/other/')
 assert.equal(cleanEvent(input({event_type:'anything'})),null)
 assert.equal(cleanEvent(input({timestamp:'2000-01-01'})),null)
 assert.equal(cleanEvent(input({session_id:'name@example.com'})),null)
})
test('collector rejects foreign origins, oversized batches and invalid event IDs',async()=>{
 const call=(body,origin='https://aeroniqx.in')=>worker.fetch(new Request('https://collector/v2/track',{method:'POST',headers:{Origin:origin},body:JSON.stringify(body)}),{})
 assert.equal((await call({version:2,events:[input()]},'https://other.example')).status,403)
 assert.equal((await call({version:2,events:Array.from({length:21},()=>input())})).status,400)
 assert.equal((await call({version:2,events:[input({event_id:'invalid'})]})).status,400)
 for(const invalid of [null,[],false,'text'])assert.equal((await call(invalid)).status,400)
 const dnt=await worker.fetch(new Request('https://collector/v2/track',{method:'POST',headers:{Origin:'https://aeroniqx.in',DNT:'1'},body:'{}'}),{})
 assert.equal(dnt.status,204)
})
test('request body cap also applies without Content-Length',async()=>{
 await assert.rejects(boundedBody(new Request('https://collector/',{method:'POST',body:'x'.repeat(20001)})))
})
test('legacy transport cannot forward raw error messages or referrer URLs',async()=>{
 const event=await legacyEvent({event_type:'error',tool:'pdf-compress',error:'secret filename',path:'/pdf-compress/?secret=1',session_id:'old-session',referrer:'https://private.example/secret'},'IN','same-event')
 const again=await legacyEvent({event_type:'error',tool:'pdf-compress',session_id:'old-session'},'IN','same-event')
 assert.equal(event.event_id,again.event_id);assert.equal(event.session_id,again.session_id)
 assert.equal(event.error_code,'processing_failed');assert.doesNotMatch(JSON.stringify(event),/secret|private\.example/)
})
test('verification rows stay out of production compatibility tabs',()=>{
 const rows=groupRows([{...cleanEvent(input()),source:'verification'}])
 assert.deepEqual(Object.keys(rows),['events_v2'])
 const live=groupRows([{...cleanEvent(input()),source:'live'}])
 assert.equal(live.tool_uses[0][2],'tool_success:quick')
})
function queue(){
 const db=new DatabaseSync(':memory:')
 const sql={exec(query,...args){const statement=db.prepare(query);return statement.columns().length?statement.all(...args):(statement.run(...args),[])}}
 const state={storage:{sql,transactionSync(fn){db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}}}
 const q=new EventQueue(state,{SHEET_ID:'16D7X2W3WBSJHVFMzuZvguuw3C5iUhvuQcKXl_FRcRnM'})
 q.set('initialized','2');for(const tab of ['events_v2','page_views','tool_uses','downloads','errors'])q.set('row_'+tab,2)
 return {q,db}
}
test('durable queue deduplicates concurrent retries by event ID',()=>{
 const {q,db}=queue(),event={...cleanEvent(input()),source:'live',country:'IN'}
 q.enqueue([event,event]);q.enqueue([event]);assert.equal(q.pending(),1);db.close()
})
test('ambiguous Sheets failure retains the exact delivery ranges and does not append twice',async()=>{
 const {q,db}=queue(),calls=[]
 q.enqueue([{...cleanEvent(input()),source:'live',country:'IN'}])
 let fail=true
 q.sheet=async(method,suffix,body)=>{
  if(method==='GET')return {sheets:['events_v2','tool_uses'].map((title,i)=>({properties:{title,sheetId:i,gridProperties:{rowCount:1000}}}))}
  calls.push(structuredClone(body));if(fail){fail=false;throw Error('Response lost after write')};return {}
 }
 await assert.rejects(q.flush());assert.equal(q.pending(),1)
 await q.flush();assert.equal(q.pending(),0);assert.deepEqual(calls[0],calls[1]);assert.equal(q.get('row_events_v2'),'3');db.close()
})
test('failed multi-tab reservation rolls back row counters and leaves events pending',async()=>{
 const {q,db}=queue();q.set('row_tool_uses',100001);q.enqueue([{...cleanEvent(input()),source:'live'}])
 await assert.rejects(q.flush(),/Archive/);assert.equal(q.get('row_events_v2'),'2');assert.equal(q.pending(),1);db.close()
})
test('recovered tool instrumentation removes old transport and covers actual file outcomes',async()=>{
 const source=await readFile(new URL('../../legacy-site/assets/index-Do-dAaN2.js',import.meta.url),'utf8')
 const patched=instrumentLegacyEvents(source)
 assert.doesNotMatch(patched,/aero-analytics\.techazzer\.workers\.dev/)
 for(const tool of ['pdf-merge','pdf-split','images-to-pdf','pdf-to-images','pdf-compress','image-compressor'])assert.ok(patched.includes(`os("tool_success",{tool:"${tool}"`))
})

async function browserHarness({blocked=false,optout=false,hostname='aeroniqx.in',failFirst=false}={}){
 const source=(await readFile(new URL('../../tools/analytics/schema.js',import.meta.url),'utf8'))+'\n'+(await readFile(new URL('../../tools/analytics/client.js',import.meta.url),'utf8'))
 const listeners=new Map(),calls=[],storage=new Map(optout?[['aeroniqx.analytics.optout','1']]:[]),sessions=new Map()
 const makeStorage=map=>({getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)})
 const choice={checked:false,addEventListener:(name,fn)=>listeners.set('choice:'+name,fn)},status={textContent:''}
 const window={addEventListener:(name,fn)=>listeners.set('window:'+name,fn)};window.top=window;window.self=window
 const location={hostname,origin:'https://'+hostname,pathname:'/bill-splitter/'}
 const context=vm.createContext({window,location,navigator:{onLine:true,globalPrivacyControl:blocked,userAgent:'Chrome/100'},document:{referrer:'https://google.com/search?q=private',getElementById:id=>id==='analytics-optout'?choice:status,addEventListener:(name,fn)=>listeners.set('document:'+name,fn)},localStorage:makeStorage(storage),sessionStorage:makeStorage(sessions),innerWidth:390,matchMedia:()=>({matches:false}),crypto,URL,AbortSignal,setTimeout:()=>1,clearTimeout:()=>{},fetch:async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:!(failFirst&&calls.length===1)}}})
 vm.runInContext(source.replaceAll('export ','')+'\ninstallAnalytics()',context)
 return {window,location,choice,status,listeners,calls,storage,sessions}
}
test('browser routes deduplicate page views and exclude private detail fields',async()=>{
 const h=await browserHarness();h.window.aeroAnalytics.route();h.window.aeroAnalytics.route()
 h.window.aeroTrack('tool_success',{action:'quick',name:'Private Person',amount:999,query:'private search'})
 await h.window.aeroAnalytics.flush()
 assert.equal(h.calls[0].events.filter(e=>e.event_type==='page_view').length,1)
 assert.equal(h.calls[0].events.length,2);assert.equal(h.calls[0].events[0].referrer,'google')
 assert.doesNotMatch(JSON.stringify(h.calls),/Private Person|private search|google\.com/)
 assert.equal('amount' in h.calls[0].events[1],false)
 h.location.pathname='/work-hours-calculator/';h.window.aeroAnalytics.route();await h.window.aeroAnalytics.flush()
 assert.equal(h.calls[1].events[0].path,'/work-hours-calculator/')
})
test('privacy signals, opt-out and local previews prevent all collection',async()=>{
 for(const settings of [{blocked:true},{optout:true},{hostname:'127.0.0.1'}]){
  const h=await browserHarness(settings);h.window.aeroTrack('tool_success',{action:'quick'});await h.window.aeroAnalytics.flush()
  assert.equal(h.calls.length,0);assert.equal(h.sessions.size,0)
 }
 const h=await browserHarness();h.choice.checked=true;h.listeners.get('choice:change')();await h.window.aeroAnalytics.flush()
 assert.equal(h.calls.length,0);assert.equal(h.sessions.size,0);assert.match(h.status.textContent,/off/)
})
test('browser retries reuse event IDs and once-per-route outcomes stay singular',async()=>{
 const h=await browserHarness({failFirst:true})
 h.window.aeroTrack('tool_success',{action:'quick'},{once:true});h.window.aeroTrack('tool_success',{action:'quick'},{once:true})
 await h.window.aeroAnalytics.flush();await h.window.aeroAnalytics.flush()
 assert.deepEqual(h.calls[0],h.calls[1]);assert.equal(h.calls[0].events.length,2)
})
