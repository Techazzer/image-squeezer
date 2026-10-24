import test from 'node:test'
import assert from 'node:assert/strict'
import { emptySheet, calculateShift, calculateSheet, currentMonday, addDays, isDate, exportCsv, csvCell, parseBackup, durationLabel } from '../../tools/work-hours/timesheet-core.js'

const shift = (start, end, breakMinutes = '', nextDay = false) => ({ start, end, breakMinutes, nextDay })

test('subtracts unpaid breaks and preserves minute precision', () => {
  assert.equal(calculateShift(shift('09:15', '17:40', '35')).minutes, 470)
  assert.equal(durationLabel(470), '7h 50m')
})
test('automatically handles an overnight shift', () => {
  assert.deepEqual(calculateShift(shift('22:00', '06:00', '30')), { empty: false, minutes: 450, breakMinutes: 30, overnight: true })
})
test('requires an explicit next day for 24 hours and rejects shifts over 24 hours', () => {
  assert.ok(calculateShift(shift('09:00', '09:00')).error)
  assert.equal(calculateShift(shift('09:00', '09:00', '', true)).minutes, 1440)
  assert.ok(calculateShift(shift('09:00', '10:00', '', true)).error)
})
test('rejects incomplete times, invalid clocks and invalid breaks', () => {
  for (const row of [shift('09:00', ''), shift('25:00', '17:00'), shift('09:60', '17:00'), shift('09:00', '10:00', '-1'), shift('09:00', '10:00', '61'), shift('09:00', '10:00', '0.5'), shift('', '', '30')]) assert.ok(calculateShift(row).error)
  assert.equal(calculateShift(shift('09:00', '10:00', '60')).minutes, 0)
})
test('blank weeks produce zero and no pay estimate', () => {
  const result = calculateSheet(emptySheet('2026-10-19'))
  assert.equal(result.valid, true)
  assert.equal(result.worked, 0)
  assert.equal(result.days, 0)
  assert.equal(result.totalPay, null)
})
test('weekly overtime is allocated after 40 paid hours without counting breaks', () => {
  const sheet = emptySheet('2026-10-19')
  sheet.rows = Array.from({ length: 7 }, (_, i) => i < 5 ? shift('09:00', '18:30', '30') : shift('', ''))
  Object.assign(sheet, { hourlyRate: '250', overtimeMode: 'weekly' })
  const r = calculateSheet(sheet)
  assert.equal(r.valid, true)
  assert.equal(r.worked, 2700)
  assert.equal(r.regular, 2400)
  assert.equal(r.overtime, 300)
  assert.equal(r.rows[4].overtime, 300)
  assert.equal(r.totalPay, 11875)
})
test('daily overtime differs from weekly overtime and supports fractional-hour thresholds', () => {
  const sheet = emptySheet('2026-10-19')
  sheet.rows[0] = shift('08:00', '18:00', '30')
  Object.assign(sheet, { hourlyRate: '100', overtimeMode: 'daily', threshold: '7.5', multiplier: '2' })
  const r = calculateSheet(sheet)
  assert.equal(r.regular, 450)
  assert.equal(r.overtime, 120)
  assert.equal(r.totalPay, 1150)
})
test('invalid pay and overtime settings prevent valid totals', () => {
  for (const settings of [{hourlyRate:'NaN'}, {hourlyRate:'-1'}, {overtimeMode:'daily',threshold:'25'}, {overtimeMode:'weekly',threshold:''}, {overtimeMode:'weekly',threshold:'0'}, {overtimeMode:'weekly',multiplier:'0.5'}, {overtimeMode:'weekly',threshold:'7.333'}]) {
    assert.equal(calculateSheet(Object.assign(emptySheet(), settings)).valid, false)
  }
  assert.equal(calculateSheet(Object.assign(emptySheet(), {hourlyRate:'0'})).totalPay, 0)
})
test('dates remain correct across months, years and daylight-saving changes', () => {
  assert.equal(addDays('2026-12-28', 6), '2027-01-03')
  assert.equal(addDays('2024-02-28', 1), '2024-02-29')
  assert.equal(addDays('2026-03-07', 2), '2026-03-09')
  assert.equal(isDate('2026-02-29'), false)
  assert.equal(currentMonday(new Date(2026, 9, 25, 0, 15)), '2026-10-19')
})
test('any invalid row invalidates the sheet; it cannot be exported as a partial total', () => {
  const sheet = emptySheet()
  sheet.rows[0] = shift('09:00', '17:00')
  sheet.rows[1] = shift('10:00', '')
  assert.equal(calculateSheet(sheet).valid, false)
  assert.throws(() => exportCsv(sheet))
})
test('CSV includes exact minutes, dates, rules and protected user text', () => {
  const sheet = emptySheet('2026-10-19')
  sheet.name = '=HYPERLINK("bad")'
  sheet.project = 'Client, "A"\nProject'
  sheet.rows[0] = shift('22:00', '06:00', '30')
  const csv = exportCsv(sheet)
  assert.ok(csv.startsWith('\uFEFF'))
  assert.ok(csv.includes('"2026-10-19","22:00","06:00","Yes","30","450","7:30","7.5000"'))
  assert.ok(csv.includes("'=HYPERLINK"))
  assert.ok(csv.includes('Client, ""A""\nProject'))
  assert.equal(csvCell(' @SUM(1)'), '"\' @SUM(1)"')
})
test('backups round-trip without accepting unexpected fields or malformed records', () => {
  const sheet = emptySheet('2026-10-19')
  sheet.rows[0] = shift('09:00', '17:00', '30')
  assert.deepEqual(parseBackup(JSON.stringify(sheet)), sheet)
  for (const value of ['{}', '{', JSON.stringify({...sheet, version:2}), JSON.stringify({...sheet, rows:[]}), JSON.stringify({...sheet, name:{html:'bad'}})]) assert.throws(()=>parseBackup(value))
  assert.throws(()=>parseBackup('x'.repeat(65537)))
})
test('minute totals and allocations conserve hours for a varied week', () => {
  const sheet = emptySheet('2026-10-19')
  sheet.rows = [shift('21:30','05:45','25'),shift('09:00','18:05','35'),shift('08:15','17:45','45'),shift('10:00','19:10','10'),shift('08:00','17:15','15'),shift('09:00','12:00'),shift('','')]
  sheet.overtimeMode='weekly'
  const r = calculateSheet(sheet)
  assert.equal(r.regular+r.overtime, r.worked)
  assert.equal(r.rows.reduce((sum,row)=>sum+row.regular+row.overtime,0), r.worked)
  assert.equal(r.rows.reduce((sum,row)=>sum+row.overtime,0), r.overtime)
})
