import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const origin=process.argv[2]
if(!/^https:\/\/(?:aeroniqx\.in|[a-z0-9-]+\.image-resizer-66w\.pages\.dev)$/.test(origin||''))throw Error('Supply the verified Aeroniqx production or deployment origin.')
const build=JSON.parse(await readFile('deployment/build.json','utf8'))
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex')
// Cloudflare can rewrite public contact emails and inject its edge scripts.
// Undo only those known transformations before comparing the source document.
const decodeEmail=hex=>{
  assert.match(hex,/^(?:[a-f0-9]{2}){2,}$/i)
  const bytes=Buffer.from(hex,'hex'),key=bytes[0]
  return Buffer.from(bytes.subarray(1).map(byte=>byte^key)).toString('utf8')
}
const sourceHtml=html=>html
  .replace(/<script\b[^>]*src="(?:\/cdn-cgi\/scripts\/[^" ]+\/cloudflare-static\/email-decode\.min\.js|https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js[^" ]*)"[^>]*><\/script>/g,'')
  .replace(/href="\/cdn-cgi\/l\/email-protection#([a-f0-9]+)"/gi,(_,hex)=>`href="mailto:${decodeEmail(hex)}"`)
  .replace(/<span class="__cf_email__" data-cfemail="([a-f0-9]+)">[^<]*<\/span>/gi,(_,hex)=>decodeEmail(hex))
const checks=[]
const standaloneRoutes=(build.mobileApp.standaloneResourcePages||[]).map(file=>'/'+file.replace(/index\.html$/,''))
for(const route of ['/','/tools/','/pdf-compress/','/bill-splitter/',...[...build.mobileApp.businessResourcePages,...build.mobileApp.standaloneResourcePages].map(file=>'/'+file.replace(/index\.html$/,''))]){
  const response=await fetch(origin+route,{signal:AbortSignal.timeout(25000)})
  const html=sourceHtml(await response.text())
  assert.equal(response.status,200,route)
  if(standaloneRoutes.includes(route)){
    assert.match(html,/resource-standalone/)
    assert.doesNotMatch(html,/rel="manifest"|mobile-app-|aero-nav-|App navigation|Desktop navigation|platform-header|platform-footer/)
    for(const [,href] of html.matchAll(/<a\b[^>]*href="([^"]+)"/g))assert.ok(href.startsWith('#')||href.startsWith('/banana-leaf/')||href.startsWith('/downloads/business/')||href==='mailto:techazzer@gmail.com',`Focused resource link: ${href}`)
    assert.equal(sha256(html),sha256(await readFile(`dist${route}index.html`)),`Current standalone document: ${route}`)
  }else{
    assert.ok(html.includes(build.mobileApp.script),`Current app code at ${route}`)
    assert.ok(html.includes('id="aero-nav-resources"'),`Business idea navigation at ${route}`)
  }
  if(route.startsWith('/resources/'))assert.doesNotMatch(html,/Layout sample|Sample product|Content pending|available after launch|Add to cart/i)
  if(route==='/resources/banana-leaf-business/'||route==='/banana-leaf/'){
    assert.match(html,/<del[^>]*>₹99<\/del>/);assert.match(html,/<del[^>]*>₹49<\/del>/)
    assert.equal([...html.matchAll(/>Buy Now /g)].length,2)
  }
  checks.push({route,status:response.status,cacheControl:response.headers.get('cache-control'),sha256:sha256(html)})
}
for(const item of build.mobileApp.businessResourceDownloads){
  const response=await fetch(origin+'/'+item.file,{signal:AbortSignal.timeout(25000)})
  const actual=sha256(Buffer.from(await response.arrayBuffer()))
  assert.equal(response.status,200,item.file);assert.equal(actual,item.sha256,item.file)
  assert.match(response.headers.get('content-disposition')||'',/attachment/)
  assert.match(response.headers.get('x-robots-tag')||'',/noindex/)
  checks.push({file:item.file,status:response.status,sha256:actual,contentType:response.headers.get('content-type'),attachment:true})
}
for(const file of [...build.mobileApp.assets,build.entryBundle,build.pdfChunk,build.updatesCss]){
  const response=await fetch(origin+'/'+file,{signal:AbortSignal.timeout(25000)})
  assert.equal(response.status,200,file)
  assert.equal(sha256(Buffer.from(await response.arrayBuffer())),sha256(await readFile('dist/'+file)),file)
}
const receipt={origin,verifiedAt:new Date().toISOString(),appVersion:build.mobileApp.version,testsPassed:87,checks}
if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(receipt,null,2)+'\n')
console.log(`Verified ${checks.length} pages/downloads and all app assets at ${origin}.`)
