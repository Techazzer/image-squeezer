import test from 'node:test'
import assert from 'node:assert/strict'
import { money, splitExpense, calculate, validateBackup, summaryText } from '../../tools/bill-splitter/split-core.js'
import { findTools } from '../../tools/app-shell/search.js'
import { coreTools } from '../../scripts/tool-content.mjs'

const people = [{ id: 'a', name: 'Priya' }, { id: 'b', name: 'Rahul' }, { id: 'c', name: 'Sam' }]
const bill = changes => ({ id: 'e1', amount: '100', description: 'Dinner', payer: 'a', method: 'equal', participants: ['a', 'b', 'c'], values: {}, ...changes })
test('money is parsed into minor units without rounding user input', () => {
  assert.equal(money('0.29'), 29)
  assert.equal(money('1000000000.00'), 100000000000)
  for (const amount of ['', '1e2', 'NaN', '1,200', '-1', '0', '1.001', '1000000000.01']) assert.throws(() => money(amount), undefined, amount)
})
test('equal splits conserve every cent, including tiny amounts', () => {
  assert.deepEqual(splitExpense(bill(), people).shares.map(p => p.amount), [3334, 3333, 3333])
  assert.deepEqual(splitExpense(bill({ amount: '0.01' }), people).shares.map(p => p.amount), [1, 0, 0])
})
test('percent splits allocate largest remainder and require exactly 100%', () => {
  assert.deepEqual(splitExpense(bill({ amount: '0.01', method: 'percent', values: { a: '20', b: '70', c: '10' } }), people).shares.map(p => p.amount), [0, 1, 0])
  assert.throws(() => splitExpense(bill({ method: 'percent', values: { a: '33.33', b: '33.33', c: '33.33' } }), people), /100%/)
  const split = splitExpense(bill({ amount: '1000000000', method: 'percent', values: { a: '33.33', b: '33.33', c: '33.34' } }), people)
  assert.deepEqual(split.shares.map(p => p.amount), [33330000000, 33330000000, 33340000000])
})
test('exact amounts accept zero shares but reject mismatched totals', () => {
  assert.deepEqual(splitExpense(bill({ method: 'exact', values: { a: '0', b: '40.25', c: '59.75' } }), people).shares.map(p => p.amount), [0, 4025, 5975])
  assert.throws(() => splitExpense(bill({ method: 'exact', values: { a: '0', b: '40', c: '59.99' } }), people), /add up/)
})
test('selected participants may exclude the payer', () => {
  const result = calculate(people, [bill({ participants: ['b', 'c'] })])
  assert.deepEqual(result.people.map(p => p.balance), [10000, -5000, -5000])
  assert.equal(result.transfers.reduce((sum, t) => sum + t.amount, 0), 10000)
})
test('sample trip nets three payments into one transfer', () => {
  const result = calculate(people, [bill({ amount: '1200' }), bill({ amount: '600', payer: 'b' }), bill({ amount: '300', payer: 'c', participants: ['a', 'c'] })])
  assert.equal(result.total, 210000)
  assert.deepEqual(result.transfers, [{ from: 'c', to: 'a', amount: 45000 }])
  assert.match(summaryText(result, 'INR', 'Weekend away'), /Sam pays Priya ₹450.00/)
})
test('settled and empty groups need no transfers', () => {
  assert.deepEqual(calculate(people, []).transfers, [])
  assert.deepEqual(calculate(people, people.map(p => bill({ amount: '99', payer: p.id }))).transfers, [])
})
test('invalid people, participants and payer cannot enter totals', () => {
  assert.throws(() => calculate([{ id: 'a', name: 'Sam' }, { id: 'b', name: ' sam ' }], []), /different names/)
  for (const change of [{ payer: 'missing' }, { participants: [] }, { participants: ['a', 'a'] }, { participants: ['unknown'] }, { method: 'other' }]) assert.throws(() => splitExpense(bill(change), people))
})
test('settlement preserves balances across varied group sizes and amounts', () => {
  for (let count = 2; count <= 50; count++) {
    const group = Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Person ${i}` }))
    const expenses = Array.from({ length: 25 }, (_, i) => bill({ amount: ((i * 7237 + count) / 100).toFixed(2), payer: group[i % count].id, participants: group.filter((_, j) => (j + i) % 3 !== 0).map(p => p.id) }))
    const result = calculate(group, expenses)
    assert.equal(result.people.reduce((sum, p) => sum + p.balance, 0), 0)
    assert.equal(result.people.reduce((sum, p) => sum + p.share, 0), result.total)
    const balances = new Map(result.people.map(p => [p.id, p.balance]))
    for (const transfer of result.transfers) {
      assert.ok(Number.isSafeInteger(transfer.amount) && transfer.amount > 0)
      balances.set(transfer.from, balances.get(transfer.from) + transfer.amount)
      balances.set(transfer.to, balances.get(transfer.to) - transfer.amount)
    }
    assert.ok([...balances.values()].every(value => value === 0))
    assert.ok(result.transfers.length <= count - 1)
  }
})
const backup = () => ({ app: 'aeroniqx-bill-splitter', version: 1, title: 'Weekend', currency: 'INR', mode: 'group', people, quick: bill({ amount: '' }), expenses: [bill()] })
test('backup round trips without losing allocation or an incomplete quick draft', () => {
  const restored = validateBackup(JSON.parse(JSON.stringify(backup())))
  assert.equal(restored.quick.amount, '')
  assert.deepEqual(calculate(restored.people, restored.expenses), calculate(people, [bill()]))
  assert.equal(Object.hasOwn(restored.quick, 'id'), false)
})
test('untrusted backups reject bad versions, currencies, duplicates and unsafe entries', () => {
  const cases = [{ version: 99 }, { currency: 'XXX' }, { expenses: [bill(), bill()] }, { expenses: [bill({ amount: '-1' })] }, { people: [...people, people[0]] }, { quick: null }, { quick: bill({ participants: ['missing'] }) }, { title: 'x'.repeat(81) }, { expenses: Array.from({ length: 501 }, (_, i) => bill({ id: `e${i}` })) }]
  for (const change of cases) assert.throws(() => validateBackup({ ...backup(), ...change }))
})
test('shared expense search finds one core tool for everyday queries', () => {
  const catalog = Object.entries(coreTools).map(([path, tool]) => ({ path, ...tool }))
  for (const query of ['split bills', 'trip expenses', 'who owes whom', 'unequal rent', 'restaurant bill']) assert.deepEqual(findTools(catalog, query).map(t => t.path), ['/bill-splitter/'])
})
