import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareOutputShare } from '../../tools/result-share/output-file.js'
import { createDirectShare } from '../../tools/result-share/controller.js'

const origin='https://aeroniqx.in'
const data={kind:'file',tool:'pdf',url:'blob:'+origin+'/test-output',filename:'example_compressed.pdf'}
const supported={share(){},canShare:()=>true}
function environment(blob,shareNavigator=supported){
 return {origin,shareNavigator,fetchFile:async url=>{assert.equal(url,data.url);return new Response(blob)}}
}

test('PDF sharing contains the exact downloadable output and only a short branded message',async()=>{
 const bytes=new TextEncoder().encode('%PDF-1.7\nsynthetic output\n%%EOF')
 const result=await prepareOutputShare({...data,before:204800,after:102400},environment(new Blob([bytes],{type:'application/pdf'})))
 const file=result.payload.files[0]
 assert.equal(file.name,'example_compressed.pdf');assert.equal(file.type,'application/pdf')
 assert.deepEqual(new Uint8Array(await file.arrayBuffer()),bytes)
 assert.equal(result.payload.text,'Made with Aeroniqx\nhttps://aeroniqx.in/pdf-compress/')
 assert.equal(result.download,file)
 assert.ok(!result.payload.text.includes(file.name))
})

test('image shares preserve output bytes, actual MIME type and matching extension',async()=>{
 for(const [type,extension] of [['image/jpeg','jpg'],['image/png','png'],['image/webp','webp']]){
  const bytes=new Uint8Array([0,1,2,3,254,255])
  const result=await prepareOutputShare({...data,tool:'image',filename:'compressed.jpg'},environment(new Blob([bytes],{type})))
  assert.equal(result.payload.files[0].name,'compressed.'+extension)
  assert.equal(result.payload.files[0].type,type)
  assert.deepEqual(new Uint8Array(await result.payload.files[0].arrayBuffer()),bytes)
  assert.equal(result.payload.text,'Made with Aeroniqx\nhttps://aeroniqx.in/image-compressor/')
 }
})

test('output preparation rejects nonlocal URLs before fetching and rejects missing or wrong outputs',async()=>{
 let requests=0
 const env={origin,shareNavigator:supported,fetchFile:async()=>{requests++;throw Error('Unexpected request')}}
 for(const url of ['https://aeroniqx.in/private.pdf','https://other.test/file','blob:https://other.test/id','data:application/pdf;base64,AAAA'])await assert.rejects(()=>prepareOutputShare({...data,url},env),/local output/)
 assert.equal(requests,0)
 await assert.rejects(()=>prepareOutputShare(data,{...env,fetchFile:async()=>new Response('',{status:404})}),/no longer available/)
 for(const blob of [new Blob([],{type:'application/pdf'}),new Blob(['x'],{type:'text/html'}),new Blob(['x'],{type:'image/png'})])await assert.rejects(()=>prepareOutputShare(data,environment(blob)),/unsupported format/)
})

test('unsupported attachment sharing downloads the actual file without opening a text-only WhatsApp share',async()=>{
 const ready=await prepareOutputShare(data,environment(new Blob(['pdf'],{type:'application/pdf'}),{}))
 assert.equal(ready.payload,null)
 const downloads=[],notes=[]
 const controller=createDirectShare({load:async()=>({prepareResultShare:async()=>ready}),navigator:{},downloadFile:file=>downloads.push(file),openWhatsApp:()=>assert.fail('Never replace the file with a promotional text-only share')})
 await controller.prepare(data)
 assert.ok(controller.readyNote.includes('download'))
 await controller.send(note=>notes.push(note))
 assert.equal(downloads[0],ready.download);assert.ok(notes[0].includes('Attach this file'))
})

test('native file sharing starts on the tap; cancellation is silent and failure keeps a file fallback',async()=>{
 let behavior='cancel',calls=0;const downloads=[],notes=[]
 const ready=await prepareOutputShare(data,environment(new Blob(['pdf'],{type:'application/pdf'})))
 const controller=createDirectShare({load:async()=>({prepareResultShare:async()=>ready}),navigator:{share:payload=>{calls++;assert.equal(payload.files[0],ready.download);return Promise.reject({name:behavior==='cancel'?'AbortError':'NotAllowedError'})}},downloadFile:file=>downloads.push(file),openWhatsApp:()=>assert.fail()})
 await controller.prepare(data);let sent=controller.send(note=>notes.push(note))
 assert.equal(calls,1);await sent
 assert.equal(notes.length,0);assert.equal(downloads.length,0)
 behavior='error';await controller.send(note=>notes.push(note))
 assert.equal(downloads.length,0);assert.ok(notes[0].includes('Tap again to download'))
 await controller.send(note=>notes.push(note));assert.equal(downloads[0],ready.download)
})

test('a late share failure cannot replace feedback for a newly prepared file',async()=>{
 let reject
 const ready=await prepareOutputShare(data,environment(new Blob(['pdf'],{type:'application/pdf'})))
 const controller=createDirectShare({load:async()=>({prepareResultShare:async()=>({...ready})}),navigator:{share:()=>new Promise((_,r)=>{reject=r})},downloadFile:()=>{},openWhatsApp:()=>{}})
 await controller.prepare(data);const operation=controller.send(()=>assert.fail('Stale share must be ignored'))
 await controller.prepare({...data,url:data.url+'new'});reject({name:'NotAllowedError'});await operation
 assert.equal(controller.hasAttachment,true)
})
