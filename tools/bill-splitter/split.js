import { CURRENCIES, MAX_PEOPLE, MAX_EXPENSES, money, decimal, formatMoney, validatePeople, splitExpense, calculate, resizePeople, validateBackup } from './split-core.js'

const $ = id => document.getElementById(id)
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const KEY = 'aeroniqx-bill-splitter-v1'
const uid = () => 'id-' + crypto.randomUUID()
const emptyBill = people => ({ amount: '', description: '', payer: people[0].id, method: 'equal', participants: people.map(p => p.id), values: {} })
function initial() {
  const people = [{ id: 'p1', name: 'You' }, { id: 'p2', name: 'Friend' }]
  return { app: 'aeroniqx-bill-splitter', version: 1, title: '', currency: 'INR', mode: 'quick', people, expenses: [], quick: emptyBill(people) }
}
let state = initial(), draft = emptyBill(state.people), editing = null, result = null, deleted = null, touched = false, remember = false
let savedText = null, unsavedDraft = false
try {
  const saved = localStorage.getItem(KEY)
  if (saved) { state = validateBackup(JSON.parse(saved)); remember = true; savedText = JSON.stringify(state); draft = emptyBill(state.people) }
} catch { $('save-status').textContent = 'Saved data could not be loaded. Your stored copy has not been replaced.' }

function status(message) { $('bs-status').textContent = message }
function notice(id, text) { $(id).textContent = text; $(id).hidden = !text }
function bill() { return state.mode === 'quick' ? state.quick : draft }
function name(id) { return state.people.find(p => p.id === id)?.name.trim() || 'Person' }
function fmt(amount) { return formatMoney(amount, state.currency) }
function persist() {
  if (!remember) return
  try {
    validateBackup(state)
    localStorage.setItem(KEY, JSON.stringify(state))
    savedText = JSON.stringify(state)
    $('save-status').textContent = 'Saved on this device. Keep a backup for another browser or device.'
  } catch { $('save-status').textContent = 'Latest changes are not saved. Check names or download a backup; browser storage may be unavailable or full.' }
}
function hasWork() { return !!(state.expenses.length || state.quick.amount || state.title || state.people.length !== 2 || state.people[0].name !== 'You' || state.people[1].name !== 'Friend' || draft.amount || draft.description) }

function confirmAction(message, label = 'Continue') {
  $('confirm-message').textContent = message
  $('confirm-accept').textContent = label
  const dialog = $('bs-confirm')
  dialog.returnValue = ''
  dialog.showModal()
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'yes'), { once: true }))
}
$('confirm-cancel').addEventListener('click', () => $('bs-confirm').close('no'))
$('confirm-accept').addEventListener('click', () => $('bs-confirm').close('yes'))
$('names-close').addEventListener('click', () => $('names-dialog').close())
$('people-count').innerHTML = Array.from({ length: MAX_PEOPLE - 1 }, (_,i) => `<option value="${i+2}">${i+2} people</option>`).join('')

function peopleValid() {
  try { validatePeople(state.people); notice('people-error', ''); return true }
  catch (error) { notice('people-error', error.message); return false }
}
function renderPeople() {
  $('people-count').value = state.people.length
  $('people-preview').textContent = state.people.slice(0,2).map(p => p.name).join(', ') + (state.people.length > 2 ? ` +${state.people.length - 2}` : '')
  $('people-preview').title = state.people.map(p => p.name).join(', ')
}
function renderPayers() {
  $('expense-payer').innerHTML = state.people.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')
  $('expense-payer').value = bill().payer
}
function renderParticipants() {
  const b = bill()
  let shares = new Map()
  try { shares = new Map(splitExpense(b, state.people).shares.map(p => [p.id, p.amount])) } catch { /* Incomplete inputs have no calculated shares. */ }
  $('participant-list').innerHTML = state.people.map(p => {
    const checked = b.participants.includes(p.id)
    return `<div class="bs-participant"><label><input type="checkbox" data-participant="${esc(p.id)}"${checked ? ' checked' : ''}><span>${esc(p.name)}</span></label>${b.method === 'equal' ? `<span data-share="${esc(p.id)}">${checked && shares.has(p.id) ? esc(fmt(shares.get(p.id))) : checked ? 'Equal share' : 'Not included'}</span>` : checked ? `<label class="bs-custom-value"><span class="bs-sr">${esc(p.name)} ${b.method === 'percent' ? 'percentage' : 'amount'}</span><input type="text" inputmode="decimal" autocomplete="off" maxlength="30" data-value="${esc(p.id)}" value="${esc(b.values[p.id] ?? '')}" placeholder="${b.method === 'percent' ? '%' : state.currency}"></label>` : '<span>Not included</span>'}</div>`
  }).join('')
  $('split-help').textContent = b.method === 'equal' ? 'Choose who shares this expense.' : b.method === 'percent' ? 'Enter percentages that total 100%.' : 'Enter amounts that total the bill.'
  $('participants-summary').textContent = b.participants.length === state.people.length ? `All ${state.people.length} people included` : `${b.participants.length} of ${state.people.length} people included`
}
function renderForm() {
  const b = bill()
  $('expense-amount').value = b.amount
  $('expense-description').value = b.description
  $('split-method').value = b.method
  $('split-people').open = b.method !== 'equal'
  $('expense-heading').textContent = state.mode === 'quick' ? 'The bill' : editing ? 'Edit expense' : 'Add an expense'
  $('expense-submit').textContent = state.mode === 'quick' ? 'See the split →' : editing ? 'Save changes' : '+ Add expense'
  $('editing-tag').hidden = !editing || state.mode !== 'group'
  $('cancel-edit').hidden = !editing || state.mode !== 'group'
  renderPayers(); renderParticipants(); touched = false
  notice('expense-error', '')
}
function renderHistory() {
  $('expense-count').textContent = `${state.expenses.length} added`
  $('expense-list').innerHTML = state.expenses.length ? state.expenses.map(e => `<article class="bs-history-row"><div class="bs-history-title"><strong>${esc(e.description.trim() || 'Expense')}</strong><strong>${esc(fmt(money(e.amount)))}</strong></div><p class="bs-small">${esc(name(e.payer))} paid · ${e.participants.length} sharing · ${e.method === 'equal' ? 'Equal split' : e.method === 'percent' ? 'Percentage split' : 'Exact amounts'}</p><div class="bs-history-actions"><button class="bs-text" type="button" data-edit="${esc(e.id)}" aria-label="Edit ${esc(e.description || 'expense')}">Edit</button><button class="bs-text bs-danger" type="button" data-delete="${esc(e.id)}" aria-label="Delete ${esc(e.description || 'expense')}">Delete</button></div></article>`).join('') : '<p class="bs-empty">No expenses yet. Add the first payment above.</p>'
}
function renderResult() {
  let problem = ''
  try {
    result = calculate(state.people, state.mode === 'quick' ? [state.quick] : state.expenses)
    if (!result.count) result = null
  } catch (error) { result = null; problem = error.message }
  $('result-label').textContent = state.mode === 'quick' ? 'BILL TOTAL' : 'GROUP TOTAL'
  $('result-heading').textContent = result ? (state.title.trim() || (state.mode === 'quick' ? 'Here’s your split.' : 'Your shared expenses.')) : 'Your split, simplified.'
  $('result-total').textContent = result ? fmt(result.total) : '—'
  $('result-meta').textContent = result ? `${result.count} expense${result.count === 1 ? '' : 's'} · ${state.people.length} people` : problem && bill().amount ? 'Complete the split details to see your result.' : state.mode === 'quick' ? 'Add an amount to get started.' : 'Add an expense to get started.'
  $('settlements').innerHTML = result ? result.transfers.length ? result.transfers.map(t => `<div class="bs-transfer"><p><b>${esc(name(t.from))}</b> pays <b>${esc(name(t.to))}</b></p><strong>${esc(fmt(t.amount))}</strong></div>`).join('') : '<p class="bs-empty">Everyone is settled. No transfers needed.</p>' : '<p class="bs-empty">Your settlement will appear here.</p>'
  $('balances').innerHTML = result ? result.people.map(p => `<div class="bs-balance"><strong>${esc(p.name)}</strong><dl><div><dt>Paid</dt><dd>${esc(fmt(p.paid))}</dd></div><div><dt>Share</dt><dd>${esc(fmt(p.share))}</dd></div><div><dt>${p.balance > 0 ? 'Receives' : p.balance < 0 ? 'Owes' : 'Settled'}</dt><dd>${esc(fmt(Math.abs(p.balance)))}</dd></div></dl></div>`).join('') : '<p class="bs-empty">Complete your first split to see the breakdown.</p>'
  $('share-summary').disabled = true
  if (result) $('share-summary').dataset.aeroShare = JSON.stringify({ kind: 'bill', result, currency: state.currency, title: state.title || (state.mode === 'quick' ? state.quick.description || 'Quick split' : 'Shared split') })
  else delete $('share-summary').dataset.aeroShare
}
function refresh() {
  const b = bill()
  let split
  try { split = splitExpense(b, state.people); notice('expense-error', '') }
  catch (error) { if (touched) notice('expense-error', error.message) }
  for (const node of document.querySelectorAll('[data-share]')) {
    const amount = split?.shares.find(p => p.id === node.dataset.share)?.amount
    node.textContent = amount !== undefined ? fmt(amount) : b.participants.includes(node.dataset.share) ? 'Equal share' : 'Not included'
  }
  if (b.method !== 'equal') {
    let sum = 0, valid = true
    for (const id of b.participants) { try { sum += money(b.values[id] || '0', true) } catch { valid = false } }
    $('split-check').textContent = valid ? b.method === 'percent' ? `${decimal(sum)}% of 100% assigned` : `${fmt(sum)} assigned${b.amount && split ? ' · Matches the bill' : ''}` : 'Use numbers with up to two decimal places.'
  } else $('split-check').textContent = split && split.shares.some(s => s.amount !== split.shares[0].amount) ? 'An extra paise/cent is assigned in participant order so the total stays exact.' : ''
  renderResult(); persist()
}
function renderAll() {
  $('bs-currency').value = state.currency
  $('amount-currency').textContent = state.currency
  $('group-name').value = state.title
  $('remember-group').checked = remember
  for (const mode of ['quick', 'group']) $('mode-' + mode).setAttribute('aria-pressed', String(state.mode === mode))
  $('mode-help').textContent = state.mode === 'quick' ? 'Split one payment. Choose the people, amount and who paid.' : 'Add payments from different people. We’ll combine them into one settlement.'
  $('expense-history').hidden = state.mode !== 'group'
  $('add-another').hidden = state.mode !== 'group'
  renderPeople(); renderForm(); renderHistory(); refresh()
}

for (const mode of ['quick', 'group']) $('mode-' + mode).addEventListener('click', () => {
  state.mode = mode; renderAll(); status(mode === 'quick' ? 'Showing your Quick Split.' : 'Showing your Shared Split.')
})
$('group-name').addEventListener('input', event => { state.title = event.target.value; renderResult(); persist() })
$('bs-currency').addEventListener('change', async event => {
  const next = event.target.value
  if (!CURRENCIES.includes(next)) return
  if ((state.expenses.length || state.quick.amount || draft.amount) && !await confirmAction('This changes the currency label for every amount. It does not convert exchange rates. Continue only if the numbers are already in the new currency.', 'Change currency')) { $('bs-currency').value = state.currency; return }
  state.currency = next; renderAll(); status('Currency changed. No exchange-rate conversion was applied.')
})
$('people-count').addEventListener('change', event => {
  try {
    const resized = resizePeople(state, draft, Number(event.target.value), editing, uid)
    state.people = resized.people; state.quick = resized.quick; draft = resized.draft
    peopleValid(); renderPeople(); renderPayers(); renderParticipants(); refresh()
    status(`${state.people.length} people. Use Edit names to personalize them.`)
  } catch (error) { $('people-count').value = state.people.length; notice('people-error', error.message) }
})
$('edit-names').addEventListener('click', () => {
  $('people-list').innerHTML = state.people.map((p,i) => `<label class="bs-field"><span>Person ${i+1}</span><input data-person="${esc(p.id)}" value="${esc(p.name)}" maxlength="40" autocomplete="off" aria-describedby="names-error"></label>`).join('')
  notice('names-error',''); $('names-dialog').showModal()
})
$('names-form').addEventListener('submit', event => {
  event.preventDefault()
  const people = state.people.map(p => ({ ...p, name: $('people-list').querySelector(`[data-person="${p.id}"]`).value.trim() }))
  try { validatePeople(people) }
  catch (error) { notice('names-error',error.message); return }
  state.people = people; peopleValid(); renderPeople(); renderPayers(); renderParticipants(); renderHistory(); refresh(); $('names-dialog').close()
})
$('expense-form').addEventListener('input', event => {
  const b = bill(), node = event.target
  if (node.id === 'expense-amount') b.amount = node.value
  if (node.id === 'expense-description') b.description = node.value
  if (node.dataset.value) b.values[node.dataset.value] = node.value
  if (state.mode === 'group') unsavedDraft = true
  refresh()
})
$('expense-payer').addEventListener('change', event => { bill().payer = event.target.value; unsavedDraft = state.mode === 'group'; refresh() })
$('split-method').addEventListener('change', event => {
  bill().method = event.target.value; bill().values = {}; touched = false
  $('split-people').open = bill().method !== 'equal'
  notice('expense-error', ''); renderParticipants(); refresh(); unsavedDraft = state.mode === 'group'
})
$('participant-list').addEventListener('change', event => {
  const id = event.target.dataset.participant
  if (!id) return
  const selected = new Set(bill().participants)
  if (event.target.checked) selected.add(id); else selected.delete(id)
  bill().participants = state.people.filter(p => selected.has(p.id)).map(p => p.id)
  renderParticipants(); refresh(); unsavedDraft = state.mode === 'group'
})
$('expense-form').addEventListener('submit', event => {
  event.preventDefault(); touched = true
  window.aeroTrack?.('tool_start',{tool:'bill-splitter',action:state.mode})
  if (!peopleValid()) {window.aeroTrack?.('tool_error',{tool:'bill-splitter',error_code:'invalid_input'}); $('people-error').scrollIntoView({ block: 'center' }); return }
  try { splitExpense(bill(), state.people) } catch (error) {window.aeroTrack?.('tool_error',{tool:'bill-splitter',error_code:'invalid_input'}); notice('expense-error', error.message); $('split-people').open = true; return }
  if (state.mode === 'quick') {
    window.aeroTrack?.('tool_success',{tool:'bill-splitter',action:'quick'})
    refresh(); document.activeElement?.blur(); $('split-result').focus({ preventScroll: true }); $('split-result').scrollIntoView({ block: 'start', behavior: 'auto' }); return
  }
  if (!editing && state.expenses.length >= MAX_EXPENSES) { notice('expense-error', 'This group has 500 expenses. Back it up and start a new group.'); return }
  const expense = { ...structuredClone(draft), id: editing || uid(), amount: decimal(money(draft.amount)) }
  if (editing) state.expenses = state.expenses.map(e => e.id === editing ? expense : e)
  else state.expenses.push(expense)
  editing = null; draft = emptyBill(state.people); unsavedDraft = false
  renderForm(); renderHistory(); refresh(); status('Expense saved. The group settlement is updated.')
  window.aeroTrack?.('tool_success',{tool:'bill-splitter',action:'group'})
  document.activeElement?.blur(); $('split-result').focus({ preventScroll: true }); $('split-result').scrollIntoView({ block: 'start', behavior: 'auto' })
})
$('cancel-edit').addEventListener('click', () => { editing = null; draft = emptyBill(state.people); unsavedDraft = false; renderForm(); refresh(); status('Edit cancelled. The saved expense is unchanged.') })
$('add-another').addEventListener('click', () => { $('expense-amount').focus(); $('expense-heading').scrollIntoView({ block: 'start', behavior: 'auto' }) })
$('expense-list').addEventListener('click', async event => {
  const edit = event.target.closest('[data-edit]')?.dataset.edit
  const remove = event.target.closest('[data-delete]')?.dataset.delete
  if (edit) {
    if (unsavedDraft && !await confirmAction('Discard the unadded expense or unsaved edit in the form?', 'Discard draft')) return
    editing = edit; draft = structuredClone(state.expenses.find(e => e.id === edit)); unsavedDraft = false
    renderForm(); refresh(); $('expense-amount').focus(); $('expense-heading').scrollIntoView({ block: 'center' })
  } else if (remove) {
    const index = state.expenses.findIndex(e => e.id === remove)
    deleted = { index, expense: state.expenses[index] }
    state.expenses.splice(index, 1)
    if (editing === remove) { editing = null; draft = emptyBill(state.people); unsavedDraft = false; renderForm() }
    $('undo-delete').hidden = false; renderHistory(); refresh(); status('Expense deleted. You can undo this deletion below.')
  }
})
$('undo-delete').addEventListener('click', () => {
  if (!deleted) return
  try { splitExpense(deleted.expense, state.people) } catch { status('Cannot restore: a person used by this expense was removed.'); return }
  if (state.expenses.length >= MAX_EXPENSES) { status('This group already has 500 expenses.'); return }
  state.expenses.splice(deleted.index, 0, deleted.expense); deleted = null; $('undo-delete').hidden = true
  renderHistory(); refresh(); status('Expense restored.')
})

$('remember-group').addEventListener('change', event => {
  remember = event.target.checked
  if (remember) persist()
  else {
    try { localStorage.removeItem(KEY); savedText = null; $('save-status').textContent = 'Not saved on this device. Your current details are still open.' }
    catch { $('save-status').textContent = 'Could not remove the saved copy. Clear this site’s browser storage to remove it.' }
  }
})
$('download-backup').addEventListener('click', () => {
  try {
    const data = validateBackup(state)
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = 'aeroniqx-bill-splitter-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000)
    status(unsavedDraft ? 'Backup downloaded. The unadded shared expense draft is not included.' : 'Editable backup downloaded. Keep it somewhere safe.')
  } catch (error) { status('Backup not downloaded: ' + error.message) }
})
$('restore-backup').addEventListener('click', () => $('backup-file').click())
$('backup-file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; event.target.value = ''
  if (!file) return
  try {
    if (file.size > 2000000) throw Error('Choose a backup smaller than 2 MB.')
    const restored = validateBackup(JSON.parse(await file.text()))
    if (hasWork() && !await confirmAction('Restoring replaces the current quick bill and group ledger. Download a backup first if you need to keep them.', 'Restore backup')) return
    state = restored; draft = emptyBill(state.people); editing = null; deleted = null; unsavedDraft = false
    $('undo-delete').hidden = true; notice('people-error', ''); renderAll(); status('Backup restored. Review the details before sharing.')
  } catch (error) { status('Backup not restored: ' + (error instanceof SyntaxError ? 'The file is not valid JSON.' : error.message)) }
})
$('start-fresh').addEventListener('click', async () => {
  if (!await confirmAction('Clear the quick bill, group expenses and saved copy on this device? Download a backup first if you need to keep them.', 'Start fresh')) return
  try { localStorage.removeItem(KEY) } catch { status('Could not clear the saved copy. Clear this site’s browser storage before starting fresh.'); return }
  state = initial(); draft = emptyBill(state.people); editing = null; deleted = null; remember = false; savedText = null; unsavedDraft = false
  $('undo-delete').hidden = true; notice('people-error', ''); $('save-status').textContent = 'Not saved on this device.'; renderAll(); status('Ready for a new bill or group.'); $('main').scrollIntoView({ block: 'start' })
})
$('try-example').addEventListener('click', async () => {
  if (hasWork() && !await confirmAction('Replace your current quick bill and expenses with a sample trip? Keep a backup first if you need your current details.', 'Load example')) return
  state = initial(); state.mode = 'group'; state.title = 'Weekend away'; state.people = [{ id: 'p1', name: 'Priya' }, { id: 'p2', name: 'Rahul' }, { id: 'p3', name: 'Sam' }]
  state.quick = emptyBill(state.people)
  state.expenses = [{ id: 'e1', description: 'Hotel', amount: '1200.00', payer: 'p1', method: 'equal', participants: ['p1', 'p2', 'p3'], values: {} }, { id: 'e2', description: 'Dinner', amount: '600.00', payer: 'p2', method: 'equal', participants: ['p1', 'p2', 'p3'], values: {} }, { id: 'e3', description: 'Taxi for Priya & Sam', amount: '300.00', payer: 'p3', method: 'equal', participants: ['p1', 'p3'], values: {} }]
  editing = null; deleted = null; draft = emptyBill(state.people); unsavedDraft = false; $('undo-delete').hidden = true; notice('people-error', ''); renderAll(); status('Example loaded: three payments, one suggested transfer. You can edit every detail.')
})
window.addEventListener('beforeunload', event => {
  if (unsavedDraft || (hasWork() && JSON.stringify(state) !== savedText)) { event.preventDefault(); event.returnValue = '' }
})
renderAll()
$('bs-app').inert = false
$('bs-app').setAttribute('aria-busy', 'false')
