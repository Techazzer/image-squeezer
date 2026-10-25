/* SHARE_MODEL */
/* OUTPUT_FILE */


async function createCards(model) {
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d')
  if (!ctx) throw Error('Image preview is unavailable in this browser.')
  const width = 800, inset = 48, inner = width - inset * 2
  const font = (size, bold = false) => { ctx.font = `${bold ? 600 : 400} ${size}px system-ui, sans-serif` }
  const wrap = (text, size, bold = false) => { font(size, bold); return wrapText(text, s => ctx.measureText(s).width, inner) }
  const title = wrap(model.title, 32, true), meta = wrap(model.meta, 22), value = wrap(model.value, 48, true)
  const note = wrap(model.note, 19)
  const headerHeight = 188 + title.length * 40 + value.length * 58 + meta.length * 30
  const footerHeight = 110 + note.length * 26
  const rows = model.rows.map(row => {
    const label = wrap(row.heading || row.label, row.heading ? 23 : 25, true)
    const detail = row.heading ? [] : wrap(row.value, 24)
    return { ...row, label, detail, height: row.heading ? label.length * 32 + 40 : label.length * 34 + detail.length * 32 + 30 }
  })
  const pages = paginateRows(rows, Math.max(400, 1480 - headerHeight - footerHeight))
  return Promise.all(pages.map(async (page, index) => {
    // Separate canvases let asynchronous encodes run without overwriting a page.
    const surface = document.createElement('canvas')
    surface.width = width; surface.height = headerHeight + page.reduce((sum, row) => sum + row.height, 0) + footerHeight
    const c = surface.getContext('2d')
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, width, surface.height)
    c.fillStyle = '#edf4ff'; c.fillRect(0, 0, width, headerHeight - 16)
    let y = 52
    const text = (lines, size, leading, color = '#202124', bold = false) => {
      c.font = `${bold ? 600 : 400} ${size}px system-ui, sans-serif`; c.fillStyle = color
      for (const line of lines) { c.fillText(line, inset, y); y += leading }
    }
    text(['Aeroniqx  /  ' + model.tool], 20, 44, '#1557b0', true)
    text(title, 32, 40, '#202124', true); y += 12
    text([model.label.toUpperCase()], 18, 58, '#536175')
    text(value, 48, 58, '#1557b0', true)
    text(meta, 22, 30, '#536175')
    y = headerHeight + 12
    for (const row of page) {
      if (row.heading) { y += 12; text(row.label, 23, 32, '#1557b0', true); y += 28 }
      else {
        text(row.label, 25, 34, '#202124', true); text(row.detail, 24, 32, '#405064'); y += 16
        c.strokeStyle = '#e7edf4'; c.beginPath(); c.moveTo(inset, y - 7); c.lineTo(width - inset, y - 7); c.stroke(); y += 14
      }
    }
    y += 12; text(note, 19, 26, '#536175')
    text(['aeroniqx.in' + model.path], 22, 32, '#1557b0', true)
    text([`Free tools · No ads${pages.length > 1 ? `  ·  Card ${index + 1} of ${pages.length}` : ''}`], 18, 24, '#536175')
    const blob = await new Promise((resolve, reject) => surface.toBlob(b => b ? resolve(b) : reject(Error('Could not create the image.')), 'image/png'))
    return new File([blob], `aeroniqx-${model.path.split('/')[1]}-${index + 1}.png`, { type: 'image/png' })
  }))
}

export async function prepareResultShare(data) {
  if (data.kind === 'file') return prepareOutputShare(data)
  const model = shareModel(data)
  try {
    if (!navigator.share || !navigator.canShare?.({ files: [new File(['probe'], 'result.png', { type: 'image/png' })] })) return { model, payload: null }
    const files = await createCards(model)
    return { model, payload: fileSharePayload(navigator, files, model) }
  } catch { return { model, payload: null } }
}
