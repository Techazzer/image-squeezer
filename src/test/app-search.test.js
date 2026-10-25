import test from 'node:test'
import assert from 'node:assert/strict'
import { findTools } from '../../tools/app-shell/search.js'
import { coreTools } from '../../scripts/tool-content.mjs'

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
