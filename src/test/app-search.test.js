import test from 'node:test'
import assert from 'node:assert/strict'
import { findTools, normalizeSavedTools, parseAppTarget } from '../../tools/app-shell/search.js'
import { coreTools } from '../../scripts/tool-content.mjs'
import { buildToolCatalog } from '../../scripts/tool-catalog.mjs'

const tools=Object.entries(coreTools).map(([path,tool])=>({path,...tool}))
test('search recognizes handwriting even when typed as two words',()=>{
  assert.deepEqual(findTools(tools,'hand writing').map(t=>t.path),['/handwriting-font/'])
  assert.deepEqual(findTools(tools,'HAND-WRITING FONT').map(t=>t.path),['/handwriting-font/'])
})
test('people can search for a task instead of a tool title',()=>{
  assert.deepEqual(findTools(tools,'monthly loan payment').map(t=>t.path),['/emi-calculator/'])
  assert.deepEqual(findTools(tools,'combine documents').map(t=>t.path),['/pdf-merge/'])
  assert.deepEqual(findTools(tools,'time sheet').map(t=>t.path),['/work-hours-calculator/'])
})
test('categories constrain results and unmatched searches stay empty',()=>{
  assert.equal(findTools(tools,'font','PDF').length,0)
  assert.equal(findTools(tools,'zzznomatch').length,0)
  assert.equal(findTools(tools,'  ').length,tools.length)
  assert.equal(findTools(tools,'','Finance').length,4)
})
test('older saved entries remain searchable without descriptions or keywords',()=>{
  assert.equal(findTools([{title:'Handwriting Font',path:'/handwriting-font/',category:'Create'}],'hand writing').length,1)
})

const pages = Object.entries(coreTools).map(([path,t])=>({path,title:t.title,html:'<h1>Tool</h1>'}))
const preset = (path,title,src)=>({path,title,html:`<iframe src="${src}"></iframe>`})
const {catalog,resources}=buildToolCatalog([...pages,
  preset('/compress-pdf-to-200kb/','Compress PDF to 200KB','/pdf-compress/?embed=1&target=200&unit=KB'),
  preset('/compress-pdf-to-1mb/','Compress PDF to 1MB','/pdf-compress/?embed=1&target=1&unit=MB'),
  preset('/resize-image-for-instagram/','Resize Image for Instagram','/image-compressor/?embed=1&width=1080&height=1080&format=jpeg'),
  preset('/resize-image-for-instagram-story/','Resize Image for Instagram Story','/image-compressor/?embed=1&width=1080&height=1920&format=jpeg'),
  preset('/monthly-sip-calculator/','Monthly SIP Calculator','/sip-calculator/?embed=1'),
  {path:'/how-to-compress-image-on-mobile/',title:'How to compress images on mobile',html:'<h1>Guide</h1>'},
])

test('browsing lists implementations once while preserving every resource link',()=>{
  assert.equal(catalog.length,13)
  assert.equal(resources.length,6)
  assert.equal(findTools(catalog,'','PDF').length,5)
  assert.equal(findTools(catalog,'SIP').length,1)
  assert.equal(findTools(catalog,'monthly SIP')[0].href,'/sip-calculator/')
  assert.ok(resources.some(t=>t.path==='/compress-pdf-to-200kb/'))
  assert.throws(()=>buildToolCatalog([...pages,{path:'/unknown-tool/',title:'New tool',html:'<h1>New tool</h1>'}]),/Classify/)
})

test('size intent opens one compressor with the exact requested settings',()=>{
  for(const [query,target,unit] of [['PDF to 200 KB','200','KB'],['compress PDF to 1MB','1','MB'],['pdf under 0.5 megabytes','0.5','MB'],['PDF to 750kb','750','KB']]) {
    const results=findTools(catalog,query)
    assert.equal(results.length,1,query)
    const url=new URL(results[0].href,'https://aeroniqx.in')
    assert.equal(url.pathname,'/pdf-compress/')
    assert.equal(url.searchParams.get('target'),target)
    assert.equal(url.searchParams.get('unit'),unit)
    assert.ok(!url.searchParams.has('embed'))
  }
  assert.equal(findTools(catalog,'image to 50 KB')[0].path,'/image-compressor/')
  assert.equal(findTools(catalog,'200 KB').length,2,'An unspecified file type offers both compressors')
  assert.equal(findTools(catalog,'PDF to -20 KB').length,0)
  assert.equal(findTools(catalog,'PDF to 501 MB').length,0)
})

test('named presets route to a parent tool without guessing ambiguous settings',()=>{
  const specific=findTools(catalog,'instagram story')
  assert.equal(specific.length,1)
  assert.match(specific[0].href,/height=1920/)
  assert.equal(findTools(catalog,'instagram')[0].href,'/image-compressor/')
  assert.match(findTools(catalog,'PNG to WebP')[0].href,/format=webp/)
  assert.match(findTools(catalog,'compress PNG')[0].href,/format=png/)
})

test('old saved presets consolidate to their parent without dropping other bookmarks',()=>{
  const saved=normalizeSavedTools([
    {path:'/compress-pdf-to-200kb/',title:'PDF 200 KB'},
    {path:'/compress-pdf-to-1mb/',title:'PDF 1 MB'},
    {path:'/pdf-compress/',title:'Compress PDF'},
    {path:'/work-hours-calculator/',title:'Work Hours'},
    {path:'/future-tool/',title:'Future tool',category:'Work'},
  ],catalog)
  assert.deepEqual(saved.map(t=>t.path),['/pdf-compress/','/work-hours-calculator/','/future-tool/'])
  assert.equal(saved[0].title,'PDF Compressor')
})

test('app target validation never silently clamps a requested size',()=>{
  assert.equal(parseAppTarget('750','KB'),750)
  assert.equal(parseAppTarget('0.5','MB'),0.5)
  assert.equal(parseAppTarget('512000','KB'),512000)
  for(const value of ['0','-1','Infinity','1e4','200oops','',null]) assert.equal(parseAppTarget(value,'KB'),null)
})
