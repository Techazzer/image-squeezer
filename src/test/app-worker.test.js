import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFile } from 'node:fs/promises'

const template = await readFile(new URL('../../tools/app-shell/service-worker.js',import.meta.url),'utf8')
function worker(network) {
  const events={},files=new Map([['/',new Response('cached home')],['/work-hours-calculator/',new Response('cached calculator')],['/bill-splitter/',new Response('cached splitter')],['/offline/',new Response('offline instructions')],['/assets/app-test.js',new Response('app code')]])
  const cache={match:async path=>files.get(path)?.clone(),put:async(path,response)=>files.set(path,response),addAll:async()=>{}}
  const scope={self:{location:{origin:'https://aeroniqx.in'},addEventListener:(name,fn)=>events[name]=fn,clients:{claim:async()=>{}}},caches:{open:async()=>cache},URL,Response,fetch:network}
  vm.runInNewContext(template.replace('__VERSION__','test').replace('__PRECACHE__',JSON.stringify(['/','/offline/','/work-hours-calculator/','/bill-splitter/','/assets/app-test.js'])),scope)
  function request(path,options={}){let response;events.fetch({request:{url:new URL(path,'https://aeroniqx.in').href,method:'GET',mode:'navigate',...options},respondWith:promise=>response=promise});return response}
  return {request,files}
}
test('offline calculator and homepage remain available, other routes show an honest fallback',async()=>{
  const w=worker(async()=>{throw Error('offline')})
  assert.equal(await (await w.request('/work-hours-calculator/')).text(),'cached calculator')
  assert.equal(await (await w.request('/')).text(),'cached home')
  assert.equal(await (await w.request('/bill-splitter/')).text(),'cached splitter')
  assert.equal(await (await w.request('/pdf-merge/')).text(),'offline instructions')
})
test('online navigation is fresh while offline HTML stays paired with installed assets',async()=>{
  const w=worker(async()=>new Response('fresh calculator'))
  assert.equal(await (await w.request('/work-hours-calculator/')).text(),'fresh calculator')
  assert.equal(await w.files.get('/work-hours-calculator/').text(),'cached calculator')
})
test('errors and query-specific pages never replace the offline calculator',async()=>{
  const w=worker(async()=>new Response('not found',{status:404}))
  assert.equal((await w.request('/work-hours-calculator/')).status,404)
  assert.equal(await w.files.get('/work-hours-calculator/').clone().text(),'cached calculator')
  await w.request('/work-hours-calculator/?embed=1')
  assert.equal(await w.files.get('/work-hours-calculator/').text(),'cached calculator')
})
test('worker never intercepts uploads, third-party requests, or unlisted file assets',()=>{
  const w=worker(async()=>{throw Error('must not fetch')})
  assert.equal(w.request('/files',{method:'POST'}),undefined)
  assert.equal(w.request('https://example.com/private'),undefined)
  assert.equal(w.request('/user-upload.png',{mode:'same-origin'}),undefined)
})
test('versioned app code can load from the offline cache',async()=>{
  const w=worker(async()=>{throw Error('offline')})
  assert.equal(await (await w.request('/assets/app-test.js',{mode:'same-origin'})).text(),'app code')
})
