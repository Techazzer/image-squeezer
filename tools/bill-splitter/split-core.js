export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'AED', 'SGD']
export const MAX_PEOPLE = 50
export const MAX_EXPENSES = 500
const MAX_AMOUNT = 100000000000 // Minor units: one billion per expense.

export function money(value, allowZero = false) {
  const text = String(value).trim()
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(text)) throw Error('Enter an amount with up to two decimal places, without commas.')
  const [whole, fraction = ''] = text.split('.')
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (result > MAX_AMOUNT || result < (allowZero ? 0 : 1)) throw Error('Enter an amount between 0.01 and 1,000,000,000.')
  return result
}

export const decimal = amount => (amount / 100).toFixed(2)
export const formatMoney = (amount, currency) => new Intl.NumberFormat('en', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount / 100)

export function validatePeople(people) {
  if (!Array.isArray(people) || people.length < 2 || people.length > MAX_PEOPLE) throw Error('Use between 2 and 50 people.')
  const ids = new Set(), names = new Set()
  for (const person of people) {
    if (!person || typeof person.id !== 'string' || !/^[a-zA-Z0-9_-]{1,60}$/.test(person.id) || ids.has(person.id)) throw Error('Each person needs a unique identifier.')
    if (typeof person.name !== 'string' || !person.name.trim() || person.name.trim().length > 40) throw Error('Give everyone a name of 1–40 characters.')
    const name = person.name.trim().toLocaleLowerCase('en')
    if (names.has(name)) throw Error('Use different names so everyone is easy to identify.')
    ids.add(person.id); names.add(name)
  }
}

// Largest remainders distribute every minor unit; ties follow participant order.
function allocate(total, weights) {
  const denominator = weights.reduce((sum, w) => sum + BigInt(w), 0n)
  const rows = weights.map((weight, index) => {
    const numerator = BigInt(total) * BigInt(weight)
    return { index, amount: Number(numerator / denominator), remainder: numerator % denominator }
  })
  let left = total - rows.reduce((sum, row) => sum + row.amount, 0)
  for (const row of [...rows].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1)) {
    if (!left) break
    row.amount++; left--
  }
  return rows.map(row => row.amount)
}

export function splitExpense(expense, people) {
  validatePeople(people)
  if (!expense || typeof expense !== 'object') throw Error('Invalid expense.')
  const total = money(expense.amount)
  const ids = new Set(people.map(p => p.id))
  if (!ids.has(expense.payer)) throw Error('Choose who paid the bill.')
  const participants = expense.participants
  if (!Array.isArray(participants) || !participants.length || participants.length > people.length || new Set(participants).size !== participants.length || participants.some(id => !ids.has(id))) throw Error('Select at least one person included in this expense.')
  if (typeof expense.description !== 'string' || expense.description.length > 100) throw Error('Keep the expense description under 100 characters.')
  let amounts
  if (expense.method === 'equal') amounts = allocate(total, participants.map(() => 1))
  else if (expense.method === 'exact') {
    amounts = participants.map(id => money(expense.values?.[id] ?? '', true))
    if (amounts.reduce((sum, value) => sum + value, 0) !== total) throw Error('The exact amounts must add up to the bill total.')
  } else if (expense.method === 'percent') {
    const weights = participants.map(id => money(expense.values?.[id] ?? '', true))
    if (weights.reduce((sum, value) => sum + value, 0) !== 10000) throw Error('The percentages must add up to 100%.')
    amounts = allocate(total, weights)
  } else throw Error('Choose an equal, percentage or exact-amount split.')
  return { total, shares: participants.map((id, index) => ({ id, amount: amounts[index] })) }
}

export function calculate(people, expenses) {
  validatePeople(people)
  if (!Array.isArray(expenses) || expenses.length > MAX_EXPENSES) throw Error('Use up to 500 expenses per group.')
  const rows = people.map(p => ({ ...p, paid: 0, share: 0, balance: 0 }))
  const byId = new Map(rows.map(p => [p.id, p]))
  let total = 0
  for (const expense of expenses) {
    const split = splitExpense(expense, people)
    total += split.total
    byId.get(expense.payer).paid += split.total
    for (const share of split.shares) byId.get(share.id).share += share.amount
  }
  for (const person of rows) person.balance = person.paid - person.share
  const creditors = rows.filter(p => p.balance > 0).map(p => ({ id: p.id, left: p.balance }))
  const debtors = rows.filter(p => p.balance < 0).map(p => ({ id: p.id, left: -p.balance }))
  const transfers = []
  // Greedy settlement reduces transfers, without claiming a global minimum.
  const descending = (a, b) => b.left - a.left
  while (creditors.length && debtors.length) {
    creditors.sort(descending); debtors.sort(descending)
    const amount = Math.min(creditors[0].left, debtors[0].left)
    transfers.push({ from: debtors[0].id, to: creditors[0].id, amount })
    creditors[0].left -= amount; debtors[0].left -= amount
    if (!creditors[0].left) creditors.shift()
    if (!debtors[0].left) debtors.shift()
  }
  return { total, people: rows, transfers, count: expenses.length }
}

// Changing the count must never rewrite an already recorded expense.
export function resizePeople(state, draft, count, editing, makeId) {
  if (!Number.isInteger(count) || count < 2 || count > MAX_PEOPLE) throw Error('Choose between 2 and 50 people.')
  const removed = new Set(state.people.slice(count).map(p => p.id))
  if (state.expenses.some(e => removed.has(e.payer) || e.participants.some(id => removed.has(id)))) throw Error('The people at the end of this list are used in saved expenses. Edit or delete those expenses before reducing the count.')
  const people = state.people.slice(0, count).map(p => ({ ...p })), added = []
  while (people.length < count) {
    let number = people.length + 1
    while (people.some(p => p.name.trim().toLowerCase() === `person ${number}`)) number++
    const person = { id: makeId(), name: `Person ${number}` }
    people.push(person); added.push(person.id)
  }
  const update = (bill, includeNew) => ({ ...bill, payer: removed.has(bill.payer) ? people[0].id : bill.payer, participants: [...bill.participants.filter(id => !removed.has(id)), ...(includeNew ? added : [])], values: Object.fromEntries(Object.entries(bill.values).filter(([id]) => !removed.has(id))) })
  return { people, quick: update(state.quick, true), draft: update(draft, !editing) }
}

export function summaryText(result, currency, title) {
  const names = new Map(result.people.map(p => [p.id, p.name.trim()]))
  return [title.trim() || 'Shared expenses', `Total: ${formatMoney(result.total, currency)} · ${result.count} expense${result.count === 1 ? '' : 's'}`, '', 'Suggested settlement', ...result.transfers.map(t => `${names.get(t.from)} pays ${names.get(t.to)} ${formatMoney(t.amount, currency)}`), ...(result.transfers.length ? [] : ['Everyone is settled.']), '', 'Paid / Share', ...result.people.map(p => `${p.name.trim()}: ${formatMoney(p.paid, currency)} paid · ${formatMoney(p.share, currency)} share`), '', 'Calculated with Aeroniqx', 'https://aeroniqx.in/bill-splitter/'].join('\n')
}

// Treat backups and local storage as untrusted; copy only known fields.
export function validateBackup(input) {
  if (!input || input.app !== 'aeroniqx-bill-splitter' || input.version !== 1) throw Error('Choose an Aeroniqx Bill Splitter backup (version 1).')
  if (!CURRENCIES.includes(input.currency) || typeof input.title !== 'string' || input.title.length > 80 || !['quick', 'group'].includes(input.mode)) throw Error('The backup has invalid settings.')
  validatePeople(input.people)
  const people = input.people.map(p => ({ id: p.id, name: p.name.trim() }))
  if (!Array.isArray(input.expenses) || input.expenses.length > MAX_EXPENSES) throw Error('The backup contains too many expenses.')
  const seen = new Set()
  const expenses = input.expenses.map(e => {
    if (!e || typeof e.id !== 'string' || !/^[a-zA-Z0-9_-]{1,60}$/.test(e.id) || seen.has(e.id)) throw Error('The backup contains invalid or repeated expenses.')
    seen.add(e.id); splitExpense(e, people)
    return { id: e.id, description: e.description, amount: decimal(money(e.amount)), payer: e.payer, method: e.method, participants: [...e.participants], values: Object.fromEntries(e.participants.map(id => [id, String(e.values?.[id] ?? '')])) }
  })
  // An unfinished quick bill is a draft; it is never included in saved totals.
  const q = input.quick
  if (!q || typeof q.amount !== 'string' || q.amount.length > 30 || typeof q.description !== 'string' || q.description.length > 100 || !people.some(p => p.id === q.payer) || !['equal', 'exact', 'percent'].includes(q.method) || !Array.isArray(q.participants) || new Set(q.participants).size !== q.participants.length || q.participants.some(id => !people.some(p => p.id === id))) throw Error('The backup contains an invalid quick bill.')
  const values = Object.fromEntries(q.participants.map(id => {
    const value = q.values?.[id] ?? ''
    if (typeof value !== 'string' || value.length > 30) throw Error('The backup contains an invalid split value.')
    return [id, value]
  }))
  return { app: input.app, version: 1, currency: input.currency, title: input.title, mode: input.mode, people, expenses, quick: { amount: q.amount, description: q.description, payer: q.payer, method: q.method, participants: [...q.participants], values } }
}
