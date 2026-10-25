const ORIGIN = 'https://aeroniqx.in'
const currencyAmount = (amount, currency) => new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
const hours = minutes => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
const bytes = size => size < 1024 ? `${size} B` : size < 1048576 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1048576).toFixed(2)} MB`

// Only explicit result fields enter the share card. Files, filenames, backups,
// document contents and browser storage are never read by the sharing module.
export function shareModel(data) {
  let model
  if (data.kind === 'bill') {
    const { result, currency } = data
    if (!result?.count || !result.people?.length) throw Error('Calculate a split first.')
    const name = id => result.people.find(p => p.id === id)?.name || 'Person'
    const transfers = result.transfers.map(t => ({ label: `${name(t.from)} pays ${name(t.to)}`, value: currencyAmount(t.amount / 100, currency) }))
    model = { title: data.title.trim() || 'Bill split', tool: 'Bill Splitter', path: '/bill-splitter/', value: currencyAmount(result.total / 100, currency), label: 'Total shared', meta: `${result.people.length} people · ${result.count} expense${result.count === 1 ? '' : 's'}`,
      rows: [{ heading: 'Who pays whom' }, ...(transfers.length ? transfers : [{ label: 'Everyone is settled', value: 'No transfers needed' }]), { heading: 'Each person’s breakdown' }, ...result.people.map(p => ({ label: p.name, value: `Paid ${currencyAmount(p.paid / 100, currency)} · Share ${currencyAmount(p.share / 100, currency)}` }))],
      note: 'Suggested settlement only. Payments are not tracked.',
      summary: transfers.length ? transfers.slice(0, 4).map(t => `${t.label} ${t.value}`).join('\n') + (transfers.length > 4 ? `\n+ ${transfers.length - 4} more transfers in the attached cards.` : '') : 'Everyone is settled. No transfers needed.' }
  } else if (data.kind === 'hours') {
    const { result, sheet } = data
    if (!result?.valid || !result.days) throw Error('Complete a valid shift first.')
    model = { title: sheet.project.trim() || 'Weekly timesheet', tool: 'Work Hours', path: '/work-hours-calculator/', value: hours(result.worked), label: 'Total paid hours', meta: `Week of ${sheet.weekStart}${sheet.name.trim() ? ` · ${sheet.name.trim()}` : ''}`,
      rows: [{ label: 'Regular hours', value: hours(result.regular) }, { label: 'Overtime', value: hours(result.overtime) }, { label: 'Unpaid breaks', value: hours(result.breaks) }, ...(result.totalPay === null ? [] : [{ label: 'Estimated gross pay', value: currencyAmount(result.totalPay, sheet.currency) }]), { heading: 'Daily paid hours' }, ...result.rows.filter(row => !row.empty).map(row => ({ label: row.date, value: hours(row.minutes) }))],
      note: 'Clock-time estimate. Pay is before taxes and deductions.', summary: `${result.days} working day${result.days === 1 ? '' : 's'} · ${hours(result.overtime)} overtime${result.totalPay === null ? '' : `\nEstimated gross pay: ${currencyAmount(result.totalPay, sheet.currency)}`}` }
  } else if (data.kind === 'compression') {
    if (![data.before, data.after].every(n => Number.isFinite(n) && n > 0)) throw Error('Complete a compression first.')
    const pdf = data.tool === 'pdf', change = (1 - data.after / data.before) * 100
    const outcome = data.after === data.before ? 'Size unchanged' : `${Math.abs(change).toFixed(1)}% ${change > 0 ? 'smaller' : 'larger'}`
    model = { title: pdf ? 'PDF compression result' : 'Image compression result', tool: pdf ? 'PDF Compressor' : 'Image Compressor', path: pdf ? '/pdf-compress/' : '/image-compressor/', value: bytes(data.after), label: 'Output size', meta: outcome,
      rows: [{ label: 'Original size', value: bytes(data.before) }, { label: 'Output size', value: bytes(data.after) }, { label: 'Size change', value: outcome }],
      note: data.unchanged ? 'Original returned; compression did not reduce its size.' : data.targetMissed ? 'The requested target size was not reached.' : 'Size summary only. The file and its contents are not included.',
      summary: `${bytes(data.before)} → ${bytes(data.after)} · ${outcome}${data.targetMissed ? '\nRequested target size was not reached.' : ''}` }
  } else throw Error('This result cannot be shared yet.')
  model.url = ORIGIN + model.path
  model.text = `${model.title}\n${model.label}: ${model.value}\n${model.meta}\n\n${model.summary}\n\nMade with Aeroniqx · Free tools, no ads\n${model.url}`
  model.fullText = `${model.title}\n${model.label}: ${model.value}\n${model.meta}\n\n${model.rows.map(row => row.heading ? '\n' + row.heading : `${row.label}: ${row.value}`).join('\n')}\n\n${model.note}\nMade with Aeroniqx · Free tools, no ads\n${model.url}`
  return model
}

// Preserve every character and row, including long names and large groups.
export function wrapText(text, measure, width) {
  const lines = []
  for (const paragraph of String(text).split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue
      if (line && measure(line + ' ' + word) <= width) { line += ' ' + word; continue }
      if (line) { lines.push(line); line = '' }
      for (const char of word) {
        if (line && measure(line + char) > width) { lines.push(line); line = '' }
        line += char
      }
    }
    lines.push(line)
  }
  return lines
}

export function paginateRows(rows, maxHeight) {
  const pages = [[]]
  let height = 0
  rows.forEach((row, index) => {
    const needed = row.height + (row.heading ? rows[index + 1]?.height || 0 : 0)
    if (height && height + needed > maxHeight) { pages.push([]); height = 0 }
    pages.at(-1).push(row); height += row.height
  })
  return pages
}

export function imageSharePayload(navigator, files, model) {
  const payload = { files, title: model.title, text: model.text }
  try { return files.length && navigator.share && navigator.canShare?.({ files }) && navigator.canShare(payload) ? payload : null }
  catch { return null }
}
