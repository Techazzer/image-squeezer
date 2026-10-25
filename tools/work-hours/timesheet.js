import { emptySheet, calculateSheet, durationLabel, money, exportCsv, parseBackup, addDays, isDate } from './timesheet-core.js'

const $ = id => document.getElementById(id)
const STORAGE_KEY = 'aeroniqx.work-hours.v1'
let sheet = emptySheet()
let remember = false
let saveError = ''
try {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) { sheet = parseBackup(stored); remember = true }
} catch { saveError = 'Your saved timesheet could not be read. You can still calculate and download a backup.' }

const fieldIds = { weekStart: 'week-start', name: 'person-name', project: 'project-name', currency: 'currency', hourlyRate: 'hourly-rate', overtimeMode: 'overtime-mode', threshold: 'threshold', multiplier: 'multiplier' }
const shortDate = value => isDate(value) ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)) : '—'
const dayName = value => isDate(value) ? new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)) : 'Day'
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))

function hasShifts() { return sheet.rows.some(row => row.start || row.end || row.breakMinutes || row.nextDay) }
function status(message, error = false) {
  $('save-status').textContent = message
  $('save-status').classList.toggle('is-error', error)
}
function persist() {
  if (!remember) return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sheet)); saveError = ''; status('Saved on this device. Download a backup for a separate copy.') }
  catch { saveError = 'This browser could not save your timesheet. Download a backup to keep your work.'; status(saveError, true) }
}

function createRows() {
  $('shift-rows').innerHTML = sheet.rows.map((_, i) => `<fieldset class="wh-shift" id="shift-${i}">
    <legend class="wh-sr-only" id="legend-${i}">Day ${i + 1} shift</legend>
    <div class="wh-day"><span id="day-${i}"></span><small id="date-${i}"></small></div>
    <label><span class="wh-control-label">Start</span><input type="time" step="60" id="start-${i}" data-row="${i}" data-key="start" aria-label="Day ${i + 1} start time" aria-describedby="error-${i}"></label>
    <div class="wh-end-field"><label><span class="wh-control-label">End</span><input type="time" step="60" id="end-${i}" data-row="${i}" data-key="end" aria-label="Day ${i + 1} end time" aria-describedby="error-${i} next-label-${i}"></label><label class="wh-next-day" id="next-wrap-${i}"><input type="checkbox" id="next-${i}" data-row="${i}" data-key="nextDay" aria-label="Day ${i + 1} ends next day"><span id="next-label-${i}">Next day</span></label></div>
    <label><span class="wh-control-label">Unpaid break</span><span class="wh-break-wrap"><input type="number" min="0" max="1440" step="1" inputmode="numeric" placeholder="0" id="break-${i}" data-row="${i}" data-key="breakMinutes" aria-label="Day ${i + 1} unpaid break minutes" aria-describedby="error-${i}"><span>min</span></span></label>
    <div class="wh-row-total"><span id="paid-${i}">—</span><small id="ot-${i}"></small></div><p class="wh-row-error" id="error-${i}" hidden></p>
  </fieldset>`).join('')
}

function hydrate() {
  for (const [key, id] of Object.entries(fieldIds)) $(id).value = sheet[key]
  sheet.rows.forEach((row, i) => {
    $(`start-${i}`).value = row.start; $(`end-${i}`).value = row.end; $(`break-${i}`).value = row.breakMinutes; $(`next-${i}`).checked = row.nextDay
  })
  $('remember-sheet').checked = remember
  render()
}

function setError(id, message = '') {
  const field = $(id), error = $(`${id}-error`)
  field.setAttribute('aria-invalid', message ? 'true' : 'false')
  if (error) error.textContent = message
}

function render() {
  const result = calculateSheet(sheet)
  sheet.rows.forEach((row, i) => {
    const calculated = result.rows[i], date = calculated.date, day = dayName(date)
    $(`day-${i}`).textContent = day
    $(`date-${i}`).textContent = shortDate(date)
    $(`legend-${i}`).textContent = `${day} ${shortDate(date)} shift`
    const names = {start:'start time',end:'end time',break:'unpaid break minutes',next:'ends next day'}
    for (const [prefix, label] of Object.entries(names)) $(`${prefix}-${i}`).setAttribute('aria-label', `${day} ${label}`)
    for (const prefix of ['start','end','break']) $(`${prefix}-${i}`).setAttribute('aria-invalid', calculated.error ? 'true' : 'false')
    $(`error-${i}`).textContent = calculated.error || ''
    $(`error-${i}`).hidden = !calculated.error
    $(`shift-${i}`).classList.toggle('is-invalid', Boolean(calculated.error))
    $(`paid-${i}`).textContent = calculated.error ? 'Check row' : calculated.empty ? '—' : durationLabel(calculated.minutes)
    $(`ot-${i}`).textContent = result.valid && calculated.overtime ? `${durationLabel(calculated.overtime)} OT` : ''
    const autoNextDay = !row.nextDay && calculated.overnight
    $(`next-label-${i}`).textContent = autoNextDay ? 'Next day (auto)' : 'Next day'
    $(`next-wrap-${i}`).classList.toggle('is-auto', Boolean(autoNextDay))
  })
  for (const key of ['weekStart','hourlyRate','threshold','multiplier']) setError(fieldIds[key], result.errors[key])
  $('overtime-settings').hidden = sheet.overtimeMode === 'none'
  $('threshold-label').textContent = `${sheet.overtimeMode === 'daily' ? 'Daily' : 'Weekly'} threshold (hours)`
  $('threshold').max = sheet.overtimeMode === 'daily' ? '24' : '168'
  const showDuration = value => result.valid ? durationLabel(value) : '—'
  $('total-hours').textContent = showDuration(result.worked)
  $('regular-hours').textContent = showDuration(result.regular)
  $('overtime-hours').textContent = showDuration(result.overtime)
  $('break-hours').textContent = showDuration(result.breaks)
  $('days-count').textContent = result.valid ? `${result.days} ${result.days === 1 ? 'day' : 'days'}` : 'Check inputs'
  $('decimal-hours').textContent = result.valid ? `${(result.worked / 60).toFixed(2)} decimal hours` : 'Complete the highlighted fields'
  $('total-pay').textContent = result.valid && result.totalPay !== null ? money(result.totalPay, sheet.currency) : '—'
  $('pay-explanation').textContent = !result.valid ? 'Fix the highlighted inputs to calculate a reliable total.' : result.totalPay === null ? 'Add an hourly rate to estimate your pay.' :
    `${money(result.regularPay, sheet.currency)} regular${result.overtime ? ` + ${money(result.overtimePay, sheet.currency)} overtime` : ''}. Before taxes and deductions.`
  const count = Object.keys(result.errors).length
  $('validation-status').textContent = count ? `Check ${count} highlighted ${count === 1 ? 'entry' : 'entries'} before exporting. Totals are paused until all entries are valid.` : result.days ? `Your ${result.days === 1 ? 'shift is' : 'shifts are'} ready to export.` : 'Add your first shift to get started.'
  $('validation-status').classList.toggle('is-error', !result.valid)
  $('download-csv').disabled = $('print-sheet').disabled = !result.valid || !result.days
  buildPrintView(result)
}

function buildPrintView(result) {
  if (!result.valid || !result.days) { $('print-view').innerHTML = '<h1>Aero Tools · Timesheet</h1><p>Complete a valid shift before printing.</p>'; return }
  $('print-view').innerHTML = `<h1>Weekly timesheet</h1><p>Aero Tools · aeroniqx.in/work-hours-calculator/</p>
    <div class="wh-print-meta"><div><p><strong>Week:</strong> ${escapeHtml(sheet.weekStart)} to ${escapeHtml(addDays(sheet.weekStart,6))}</p>${sheet.name ? `<p><strong>Name:</strong> ${escapeHtml(sheet.name)}</p>` : ''}${sheet.project ? `<p><strong>Project:</strong> ${escapeHtml(sheet.project)}</p>` : ''}</div><div><p><strong>Paid hours:</strong> ${durationLabel(result.worked)} (${(result.worked / 60).toFixed(2)} decimal)</p><p><strong>Regular:</strong> ${durationLabel(result.regular)} · <strong>Overtime:</strong> ${durationLabel(result.overtime)}</p></div></div>
    <table><thead><tr><th>Date</th><th>Start</th><th>End</th><th>Unpaid break</th><th>Paid hours</th><th>Decimal</th><th>Overtime</th></tr></thead><tbody>${result.rows.map((row,i)=>`<tr><td>${escapeHtml(row.date)} (${dayName(row.date)})</td><td>${escapeHtml(sheet.rows[i].start) || '—'}</td><td>${escapeHtml(sheet.rows[i].end) || '—'}${row.overnight ? ' (+1 day)' : ''}</td><td>${row.empty ? '—' : `${row.breakMinutes} min`}</td><td>${row.empty ? '—' : durationLabel(row.minutes)}</td><td>${row.empty ? '—' : (row.minutes/60).toFixed(2)}</td><td>${row.overtime ? durationLabel(row.overtime) : '—'}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="3">Weekly total</td><td>${result.breaks} min</td><td>${durationLabel(result.worked)}</td><td>${(result.worked/60).toFixed(2)}</td><td>${durationLabel(result.overtime)}</td></tr></tfoot></table>
    <p><strong>Overtime rule:</strong> ${sheet.overtimeMode === 'none' ? 'None' : `${escapeHtml(sheet.threshold)} hours per ${sheet.overtimeMode === 'daily' ? 'day' : 'week'}, at ${escapeHtml(sheet.multiplier)}× pay.`}</p>
    ${result.totalPay === null ? '' : `<h2>Estimated gross pay: ${money(result.totalPay,sheet.currency)}</h2><p>Hourly rate: ${money(Number(sheet.hourlyRate),sheet.currency)} · Regular pay: ${money(result.regularPay,sheet.currency)} · Overtime pay: ${money(result.overtimePay,sheet.currency)}</p>`}
    <p class="print-note">Clock-time estimate. Shifts are assigned to their start date. Overtime follows the selected rule; taxes, deductions and daylight-saving adjustments are excluded. Free calculator — no ads, no login, no watermark.</p>`
}

function download(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

createRows()
hydrate()
$('calculator-ui').hidden = false
status(saveError || (remember ? 'Restored your timesheet from this device.' : 'Not saved on this device.'), Boolean(saveError))

$('shift-rows').addEventListener('input', event => {
  const {row, key} = event.target.dataset
  if (row === undefined || !key) return
  sheet.rows[Number(row)][key] = key === 'nextDay' ? event.target.checked : event.target.validity.badInput ? 'invalid' : event.target.value
  render(); persist()
})
for (const [key, id] of Object.entries(fieldIds)) {
  $(id).addEventListener('input', () => {
    const previous = sheet[key]
    sheet[key] = $(id).validity.badInput ? 'invalid' : $(id).value
    if (key === 'overtimeMode' && previous !== sheet[key] && sheet[key] !== 'none') {
      sheet.threshold = sheet[key] === 'daily' ? '8' : '40'
      $('threshold').value = sheet.threshold
    }
    render(); persist()
  })
}
$('sample-week').addEventListener('click', () => {
  if (hasShifts() && !confirm('Replace the entered shifts with a sample week? Your name and pay settings will stay.')) return
  sheet.rows = Array.from({length:7},(_,i)=>i<5 ? {start:'09:00',end:'17:30',breakMinutes:'30',nextDay:false} : {start:'',end:'',breakMinutes:'',nextDay:false})
  hydrate(); persist()
})
$('clear-sheet').addEventListener('click', () => {
  if (!confirm('Clear this timesheet and its pay settings? Download a backup first if you want to keep it.')) return
  sheet = emptySheet(isDate(sheet.weekStart) ? sheet.weekStart : undefined)
  hydrate(); persist()
})
$('remember-sheet').addEventListener('change', () => {
  remember = $('remember-sheet').checked
  if (remember) persist()
  else {
    try { localStorage.removeItem(STORAGE_KEY); status('Local saved copy removed. Your current entries remain until you leave this page.') }
    catch { status('Your browser did not allow removing the saved copy. Clear this site’s browser data to remove it.', true) }
  }
})
$('download-csv').addEventListener('click', () => download(exportCsv(sheet), 'text/csv;charset=utf-8', `aeroniqx-timesheet-${sheet.weekStart}.csv`))
$('print-sheet').addEventListener('click', () => { buildPrintView(calculateSheet(sheet)); window.print() })
window.addEventListener('beforeprint', () => buildPrintView(calculateSheet(sheet)))
$('download-backup').addEventListener('click', () => download(JSON.stringify(sheet,null,2), 'application/json', `aeroniqx-timesheet-${sheet.weekStart || 'draft'}.json`))
$('restore-backup').addEventListener('click', () => $('backup-file').click())
$('backup-file').addEventListener('change', async () => {
  const file = $('backup-file').files[0]
  if (!file) return
  try {
    if (file.size > 65536) throw new Error('Choose a timesheet backup smaller than 64 KB.')
    const restored = parseBackup(await file.text())
    if ((hasShifts() || sheet.name || sheet.project) && !confirm('Replace your current entries with this backup?')) return
    sheet = restored; hydrate(); persist(); status(remember && !saveError ? 'Backup restored and saved on this device.' : 'Backup restored. Local saving is off; keep your backup file.')
    if (remember && saveError) status(saveError, true)
  } catch (error) { status(error instanceof SyntaxError ? 'This file is not a valid JSON timesheet backup.' : error.message, true) }
  finally { $('backup-file').value = '' }
})
