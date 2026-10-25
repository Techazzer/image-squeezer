import test from 'node:test'
import assert from 'node:assert/strict'
import { createDirectShare } from '../../tools/result-share/controller.js'
import { resizePeople, calculate } from '../../tools/bill-splitter/split-core.js'

function fixture() {
  const people = [{id:'p1',name:'You'},{id:'p2',name:'Friend'}]
  const quick = { amount:'100',description:'Dinner',payer:'p1',method:'equal',participants:['p1','p2'],values:{} }
  return { people, quick, expenses:[] }
}
test('people count grows with unique names and IDs, preserving existing names and selections', () => {
  const state=fixture(); state.people[0].name='Person 3'; state.quick.participants=['p1']
  let id=2
  const next=resizePeople(state,state.quick,10,false,()=>`p${++id}`)
  assert.equal(next.people.length,10)
  assert.equal(new Set(next.people.map(p=>p.name)).size,10)
  assert.equal(new Set(next.people.map(p=>p.id)).size,10)
  assert.equal(next.people[0].name,'Person 3')
  assert.ok(!next.quick.participants.includes('p2'))
  assert.equal(next.draft.participants.length,9)
  assert.equal(state.people.length,2)
})
test('reducing count removes only unused trailing people and cleans their draft shares', () => {
  const state=fixture(); let id=2
  Object.assign(state,resizePeople(state,state.quick,4,false,()=>`p${++id}`))
  state.quick.payer='p4'; state.quick.values={p1:'25',p2:'25',p3:'25',p4:'25'}
  const next=resizePeople(state,state.quick,2,false,()=>{throw Error()})
  assert.equal(next.quick.payer,'p1')
  assert.deepEqual(next.quick.participants,['p1','p2'])
  assert.deepEqual(next.quick.values,{p1:'25',p2:'25'})
  assert.equal(calculate(next.people,[{...next.quick,method:'equal'}]).total,10000)
})
test('saved expenses and an existing edit keep their membership when count increases', () => {
  const state=fixture(); state.expenses=[{...state.quick,id:'e1'}]
  const before=JSON.stringify(state)
  const next=resizePeople(state,state.quick,3,true,()=> 'p3')
  assert.deepEqual(next.draft.participants,['p1','p2'])
  assert.deepEqual(next.quick.participants,['p1','p2','p3'])
  assert.equal(JSON.stringify(state),before)
  const expanded={...state,people:next.people,quick:next.quick,expenses:[{...state.quick,payer:'p3'}]}
  assert.throws(()=>resizePeople(expanded,next.draft,2,false,()=>''),/saved expenses/)
  assert.equal(expanded.people.length,3)
  for(const n of [1,51,2.5,NaN]) assert.throws(()=>resizePeople(state,state.quick,n,false,()=>''))
})

const prepared = key => ({ model:{fullText:`Complete result ${key}`}, payload:{files:[`image-${key}`],text:`Summary ${key}`} })
test('share invokes native API synchronously on the first tap, with already prepared files', async () => {
  let shared, opened, finish
  const controller=createDirectShare({load:async()=>({prepareResultShare:async key=>prepared(key)}),navigator:{share:data=>{shared=data;return new Promise(resolve=>{finish=resolve})}},openWhatsApp:text=>{opened=text}})
  await controller.prepare('latest')
  const pending=controller.send(()=>{})
  assert.deepEqual(shared,prepared('latest').payload)
  assert.equal(controller.ready,false)
  await controller.send(()=>assert.fail('duplicate share'))
  assert.equal(opened,undefined)
  finish(); await pending
  assert.equal(controller.ready,true)
})
test('a stale asynchronous image cannot replace a newer result or an invalidated result', async () => {
  const completions=new Map(); let shared
  const controller=createDirectShare({load:async()=>({prepareResultShare:key=>new Promise(resolve=>completions.set(key,resolve))}),navigator:{share:data=>{shared=data}},openWhatsApp:()=>{}})
  const old=controller.prepare('old'); await Promise.resolve()
  const latest=controller.prepare('new'); await Promise.resolve()
  completions.get('new')(prepared('new')); await latest
  completions.get('old')(prepared('old')); assert.equal(await old,false)
  await controller.send(()=>{}); assert.equal(shared.text,'Summary new')
  const stale=controller.prepare('stale'); await Promise.resolve()
  await controller.prepare(null); completions.get('stale')(prepared('stale')); await stale
  assert.equal(controller.ready,false)
})
test('cancelling does not open WhatsApp; an unsupported browser uses full text on its tap', async () => {
  const opened=[]
  const controller=createDirectShare({load:async()=>({prepareResultShare:async()=>prepared('bill')}),navigator:{share:()=>Promise.reject({name:'AbortError'})},openWhatsApp:text=>opened.push(text)})
  await controller.prepare('bill'); await controller.send(()=>assert.fail('Cancellation should be silent'))
  assert.equal(opened.length,0); assert.equal(controller.hasAttachment,true)
  const fallback=createDirectShare({load:async()=>({prepareResultShare:async()=>({model:{fullText:'Every settlement'},payload:null})}),navigator:{},openWhatsApp:text=>opened.push(text)})
  await fallback.prepare('bill'); const promise=fallback.send(()=>{})
  assert.deepEqual(opened,['Every settlement']); await promise
})
test('sharing failure keeps the single action and offers text fallback on the next user tap', async () => {
  const opened=[],notes=[]
  const controller=createDirectShare({load:async()=>({prepareResultShare:async()=>prepared('bill')}),navigator:{share:()=>Promise.reject({name:'NotAllowedError'})},openWhatsApp:text=>opened.push(text)})
  await controller.prepare('bill'); await controller.send(text=>notes.push(text))
  assert.equal(opened.length,0); assert.ok(notes[0].includes('Tap again'))
  await controller.send(()=>{}); assert.deepEqual(opened,['Complete result bill'])
})
