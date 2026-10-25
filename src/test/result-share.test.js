import test from 'node:test'
import assert from 'node:assert/strict'
import { shareModel, wrapText, paginateRows, fileSharePayload } from '../../tools/result-share/model.js'
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
  assert.equal(model.fullText.match(/ pays Person 0:/g).length,49)
  assert.ok(model.fullText.includes('Person 49: Paid'))
  assert.ok(model.fullText.includes('https://aeroniqx.in/bill-splitter/'))
  assert.ok(!model.fullText.includes('attached cards'))
})
test('file outputs cannot accidentally fall back to a compression statistics screenshot', () => {
  assert.throws(() => shareModel({ kind: 'compression', tool: 'pdf', before: 204800, after: 102400 }))
  assert.throws(() => shareModel({ kind: 'file', tool: 'image', url: 'blob:output' }))
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
  assert.deepEqual(fileSharePayload(nav, files, model), { files, title:model.title, text:model.text })
  assert.equal(fileSharePayload({}, files, model), null)
  assert.equal(fileSharePayload({ ...nav, canShare: () => false }, files, model), null)
  assert.equal(fileSharePayload({ ...nav, canShare: () => { throw Error('blocked') } }, files, model), null)
})
