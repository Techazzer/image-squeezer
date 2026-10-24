export const CURRENCIES = ['INR', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'AED', 'SGD']
export const SCHEMA_VERSION = 1

export function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value && Number(value.slice(0, 4)) >= 1900
}

export function addDays(value, count) {
  if (!isDate(value)) return ''
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + count)
  return date.toISOString().slice(0, 10)
}

export function currentMonday(now = new Date()) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  date.setDate(date.getDate() - (date.getDay() + 6) % 7)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function emptySheet(weekStart = currentMonday()) {
  return { version: SCHEMA_VERSION, weekStart, name: '', project: '', currency: 'INR', hourlyRate: '',
    overtimeMode: 'none', threshold: '40', multiplier: '1.5',
    rows: Array.from({ length: 7 }, () => ({ start: '', end: '', breakMinutes: '', nextDay: false })) }
}

export function clockMinutes(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')) return null
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

export function calculateShift(row) {
  if (!row.start && !row.end && !row.breakMinutes && !row.nextDay) return { empty: true, minutes: 0, breakMinutes: 0, overnight: false }
  const start = clockMinutes(row.start), end = clockMinutes(row.end)
  if (start === null || end === null) return { error: 'Enter both a valid start and end time.' }
  const overnight = Boolean(row.nextDay) || end < start
  const duration = end - start + (overnight ? 1440 : 0)
  if (duration === 0) return { error: 'Start and end are the same. Select next day for a 24-hour shift.' }
  if (duration < 0 || duration > 1440) return { error: 'A shift must be between 1 minute and 24 hours.' }
  const breakMinutes = row.breakMinutes === '' ? 0 : Number(row.breakMinutes)
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0) return { error: 'Enter unpaid break minutes as a whole number, zero or more.' }
  if (breakMinutes > duration) return { error: 'The unpaid break cannot be longer than the shift.' }
  return { empty: false, minutes: duration - breakMinutes, breakMinutes, overnight }
}

export function calculateSheet(sheet) {
  const errors = {}
  if (!isDate(sheet.weekStart) || !isDate(addDays(sheet.weekStart, 6))) errors.weekStart = 'Choose a valid week starting date.'
  if (!CURRENCIES.includes(sheet.currency)) errors.currency = 'Choose a supported currency.'
  const hasRate = String(sheet.hourlyRate).trim() !== ''
  const rate = hasRate ? Number(sheet.hourlyRate) : null
  if (hasRate && (!Number.isFinite(rate) || rate < 0 || rate > 100000000)) errors.hourlyRate = 'Enter an hourly rate from 0 to 100,000,000.'
  if (!['none', 'daily', 'weekly'].includes(sheet.overtimeMode)) errors.overtimeMode = 'Choose an overtime rule.'
  let threshold = 0, multiplier = 1
  if (sheet.overtimeMode !== 'none') {
    const hours = Number(sheet.threshold)
    const max = sheet.overtimeMode === 'daily' ? 24 : 168
    if (!String(sheet.threshold).trim() || !Number.isFinite(hours) || hours <= 0 || hours > max || Math.abs(hours * 60 - Math.round(hours * 60)) > 0.000001) {
      errors.threshold = `Enter a threshold above 0 and up to ${max} hours, in whole-minute increments.`
    } else threshold = Math.round(hours * 60)
    multiplier = Number(sheet.multiplier)
    if (!String(sheet.multiplier).trim() || !Number.isFinite(multiplier) || multiplier < 1 || multiplier > 10) errors.multiplier = 'Enter an overtime multiplier from 1 to 10.'
  }
  let worked = 0, regular = 0, overtime = 0, breaks = 0, days = 0
  const rows = sheet.rows.map((row, index) => {
    const result = calculateShift(row)
    if (result.error) errors[`row-${index}`] = result.error
    let extra = 0
    if (!result.error && !result.empty) {
      if (sheet.overtimeMode === 'daily') extra = Math.max(0, result.minutes - threshold)
      if (sheet.overtimeMode === 'weekly') extra = Math.max(0, worked + result.minutes - threshold) - Math.max(0, worked - threshold)
      worked += result.minutes
      overtime += extra
      regular += result.minutes - extra
      breaks += result.breakMinutes
      days += 1
    }
    return { ...result, date: addDays(sheet.weekStart, index), regular: (result.minutes || 0) - extra, overtime: extra }
  })
  const regularPay = hasRate ? regular / 60 * rate : null
  const overtimePay = hasRate ? overtime / 60 * rate * multiplier : null
  return { valid: !Object.keys(errors).length, errors, rows, worked, regular, overtime, breaks, days,
    regularPay, overtimePay, totalPay: hasRate ? regularPay + overtimePay : null, multiplier }
}

export function durationLabel(minutes) {
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

export function money(value, currency) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

export function csvCell(value) {
  let text = String(value ?? '')
  // Spreadsheet programs can execute formula-looking user text, even inside quotes.
  if (/^[\s\uFEFF]*[=+@-]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export function exportCsv(sheet) {
  const result = calculateSheet(sheet)
  if (!result.valid || !result.days) throw new Error('Complete a valid shift before exporting.')
  const rows = [
    ['Aero Tools - Work Hours & Timesheet'], ['Name', sheet.name], ['Project', sheet.project], ['Week starting', sheet.weekStart],
    ['Currency', sheet.currency], ['Hourly rate', sheet.hourlyRate], ['Overtime rule', sheet.overtimeMode],
    ['Overtime threshold (hours)', sheet.overtimeMode === 'none' ? '' : sheet.threshold],
    ['Overtime multiplier', sheet.overtimeMode === 'none' ? '' : sheet.multiplier], [],
    ['Date', 'Start', 'End', 'End next day', 'Unpaid break (minutes)', 'Worked (minutes)', 'Worked (h:mm)', 'Decimal hours', 'Regular hours', 'Overtime hours'],
  ]
  result.rows.forEach((row, index) => {
    if (row.empty) return
    const source = sheet.rows[index]
    rows.push([row.date, source.start, source.end, row.overnight ? 'Yes' : 'No', row.breakMinutes, row.minutes,
      `${Math.floor(row.minutes / 60)}:${String(row.minutes % 60).padStart(2, '0')}`, (row.minutes / 60).toFixed(4),
      (row.regular / 60).toFixed(4), (row.overtime / 60).toFixed(4)])
  })
  rows.push(['TOTAL', '', '', '', result.breaks, result.worked, `${Math.floor(result.worked / 60)}:${String(result.worked % 60).padStart(2, '0')}`,
    (result.worked / 60).toFixed(4), (result.regular / 60).toFixed(4), (result.overtime / 60).toFixed(4)])
  if (result.totalPay !== null) rows.push([], ['Regular pay', result.regularPay.toFixed(2)], ['Overtime pay', result.overtimePay.toFixed(2)], ['Estimated gross pay', result.totalPay.toFixed(2)])
  rows.push([], ['Note', 'Clock-time estimate. Shifts belong to their start date. Overtime uses your chosen rule; taxes and deductions are excluded.'])
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export function parseBackup(text) {
  if (text.length > 65536) throw new Error('Choose an Aero Tools timesheet backup smaller than 64 KB.')
  const value = JSON.parse(text)
  if (!value || value.version !== SCHEMA_VERSION || !Array.isArray(value.rows) || value.rows.length !== 7) throw new Error('This is not a supported timesheet backup.')
  const sheet = emptySheet()
  for (const key of ['weekStart', 'name', 'project', 'currency', 'hourlyRate', 'overtimeMode', 'threshold', 'multiplier']) {
    if (typeof value[key] !== 'string' || value[key].length > 120) throw new Error('The backup contains an invalid field.')
    sheet[key] = value[key]
  }
  if (!isDate(sheet.weekStart) || !CURRENCIES.includes(sheet.currency) || !['none', 'daily', 'weekly'].includes(sheet.overtimeMode)) throw new Error('The backup contains invalid settings.')
  sheet.rows = value.rows.map(row => {
    if (!row || ['start', 'end', 'breakMinutes'].some(key => typeof row[key] !== 'string' || row[key].length > 16) || typeof row.nextDay !== 'boolean') throw new Error('The backup contains an invalid shift.')
    return { start: row.start, end: row.end, breakMinutes: row.breakMinutes, nextDay: row.nextDay }
  })
  return sheet
}
