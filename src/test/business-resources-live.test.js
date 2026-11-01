import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { validateFreeCatalog, productPath } from '../../scripts/business-resources-live.mjs'
import { landingPath, landingProductPath } from '../../scripts/business-resource-landing.mjs'

const catalog=JSON.parse(await readFile(new URL('../../content/business-resources.json',import.meta.url),'utf8'))
test('launch catalog has only published resources and free products at the requested list prices',()=>{
  validateFreeCatalog(catalog)
  assert.deepEqual(catalog.products.map(p=>[p.listPricePaise,p.pricePaise]),[[9900,0],[4900,0]])
  assert.deepEqual(catalog.products.map(p=>p.files.length),[2,1])
  assert.equal(catalog.resources.length,1)
  assert.equal(productPath(catalog.products[0]),'/resources/downloads/banana-leaf-suppliers/')
  assert.equal(landingPath(catalog.resources[0]),'/banana-leaf/')
  assert.equal(landingProductPath(catalog.resources[0],catalog.products[0]),'/banana-leaf/banana-leaf-suppliers/')
})
test('free launch cannot accidentally publish a charge or unfinished product',()=>{
  for(const change of [d=>d.products[0].pricePaise=9900,d=>d.products[0].status='sample',d=>d.resources[0].status='planned',d=>d.products[0].files=[]]){
    const data=structuredClone(catalog);change(data);assert.throws(()=>validateFreeCatalog(data))
  }
})
test('only local allowlisted download filenames and linked products can be published',()=>{
  const unsafeLanding=structuredClone(catalog)
  unsafeLanding.resources[0].landingSlug='../tools'
  assert.throws(()=>validateFreeCatalog(unsafeLanding),/Standalone landing paths/)
  for(const change of [d=>d.products[0].files[0].file='../secret.pdf',d=>d.products[0].files[0].file='suppliers.html',d=>d.products[1].id=d.products[0].id,d=>d.resources[0].products.push('missing')]){
    const data=structuredClone(catalog);change(data);assert.throws(()=>validateFreeCatalog(data))
  }
})
