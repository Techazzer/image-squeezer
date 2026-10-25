import test from 'node:test'
import assert from 'node:assert/strict'
import { shareModel, wrapText, paginateRows, imageSharePayload } from '../../tools/result-share/model.js'
import { calculate } from '../../tools/bill-splitter/split-core.js'
import { emptySheet, calculateSheet } from '../../tools/work-hours/timesheet-core.js'

test('bill cards retain exact rounded shares and settlement, with a clean calculator link', () => {
  const people = ['A','B','C'].map(id => ({ id, name: id }))
  const result = calculate(people, [{ description: '', amount: '100', payer: 'A', method: 'equal', participants: ['A','B','C'], values: {} }])
  const model = shareModel({ kind: 'bill', result, currency: 'INR', title: 'Dinner' })
  assert.equal(model.value, '₹100.00')
  assert.ok(model.rows.some(r => r.label === 'B pays A' && r.value === '₹33.33'))
  assert.ok(model.rows.some(r => r.label === 'A' && r.value.includes('Share ₹33.34')))
  assert.equal(model.url, 'https://aeroniqx.in/bill-splitter/')
  assert.ok(model.text.includes('Aeroniqx'))
})
test('large groups keep every transfer and person in cards while text stays short', () => {
  const people = Array.from({ length: 50 }, (_,i) => ({ id: String(i), name: `Person ${i}` }))
  const result = calculate(people, [{ description: '', amount: '500', payer: '0', method: 'equal', participants: people.map(p => p.id), values: {} }])
  const model = shareModel({ kind: 'bill', result, currency: 'INR', title: 'Group' })
  assert.equal(model.rows.filter(r => r.label?.includes(' pays ')).length, 49)
  assert.ok(model.rows.some(r => r.label === 'Person 49'))
  assert.ok(model.text.includes('45 more transfers'))
  assert.ok(model.text.length < 800)
})
test('compression shares metrics without file content, names, or false reduction claims', () => {
  const model = shareModel({ kind: 'compression', tool: 'pdf', before: 204800, after: 102400, filename: 'private.pdf', url: 'blob:secret' })
  assert.equal(model.value, '100.0 KB')
  assert.ok(model.text.includes('50.0% smaller'))
  assert.ok(!JSON.stringify(model).includes('private.pdf'))
  assert.ok(!JSON.stringify(model).includes('blob:secret'))
  assert.ok(shareModel({ kind: 'compression', before: 100, after: 125 }).text.includes('25.0% larger'))
  assert.ok(shareModel({ kind: 'compression', before: 100, after: 100, unchanged: true }).note.includes('Original returned'))
  assert.ok(shareModel({ kind: 'compression', before: 200, after: 150, targetMissed: true }).text.includes('not reached'))
  assert.throws(() => shareModel({ kind: 'compression', before: 0, after: 10 }))
})
test('timesheet shares validated hours, dates and optional gross pay only', () => {
  const sheet = emptySheet('2026-10-19')
  sheet.rows[0] = { start: '22:00', end: '06:00', breakMinutes: '30', nextDay: false }
  sheet.hourlyRate = '100'
  const model = shareModel({ kind: 'hours', sheet, result: calculateSheet(sheet) })
  assert.equal(model.value, '7h 30m')
  assert.ok(model.rows.some(r => r.label === '2026-10-19' && r.value === '7h 30m'))
  assert.ok(model.text.includes('₹750.00'))
  sheet.rows[1].start = '12:00'
  assert.throws(() => shareModel({ kind: 'hours', sheet, result: calculateSheet(sheet) }))
})
test('text wrapping preserves long names and unicode; pagination loses no rows or headings', () => {
  const text = 'अंजलि😊'.repeat(20)
  const lines = wrapText(text, s => [...s].length * 10, 80)
  assert.equal(lines.join(''), text)
  assert.ok(lines.every(s => [...s].length <= 8))
  const rows = [{height:70},{height:30,heading:true},{height:60},{height:40},{height:30,heading:true},{height:50}]
  const pages = paginateRows(rows, 100)
  assert.deepEqual(pages.flat(), rows)
  assert.ok(pages.every(page => !page.at(-1).heading))
  assert.ok(pages.every(page => page.reduce((n,r) => n + r.height, 0) <= 100))
})
test('native sharing uses prepared images and text only when file sharing is supported', () => {
  const files = ['prepared-file'], model = { title:'Dinner', text:'A pays B ₹100\nhttps://aeroniqx.in/bill-splitter/' }
  const nav = { share() {}, canShare: data => Array.isArray(data.files) }
  assert.deepEqual(imageSharePayload(nav, files, model), { files, title:model.title, text:model.text })
  assert.equal(imageSharePayload({}, files, model), null)
  assert.equal(imageSharePayload({ ...nav, canShare: () => false }, files, model), null)
  assert.equal(imageSharePayload({ ...nav, canShare: () => { throw Error('blocked') } }, files, model), null)
})
