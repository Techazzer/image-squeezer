/* SHARE_MODEL */
let activeDialog = null

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

export async function openResultShare(data) {
  if (activeDialog?.open) return
  const model = shareModel(data), focus = document.activeElement
  const dialog = document.createElement('dialog'); activeDialog = dialog
  dialog.className = 'aero-share'; dialog.setAttribute('aria-labelledby', 'aero-share-title')
  dialog.innerHTML = `<div class="aero-share-head"><h2 id="aero-share-title">Share your result</h2><button type="button" data-close aria-label="Close sharing preview" autofocus>×</button></div><div class="aero-share-body"><p class="aero-share-hint">Preview what you’ll share. Choose WhatsApp from your phone’s share menu.</p><div class="aero-share-preview" aria-busy="true"><p>Creating your image…</p></div><div class="aero-share-pages" hidden><button type="button" data-prev aria-label="Previous image">←</button><span data-page></span><button type="button" data-next aria-label="Next image">→</button></div><label class="aero-share-text-label">Short message<textarea readonly aria-label="Message to share"></textarea></label><p class="aero-share-status" role="status" aria-live="polite"></p></div><div class="aero-share-actions"><button type="button" data-native class="aero-share-primary" disabled>Share image + text</button><div><button type="button" data-copy>Copy text</button><a data-whatsapp target="_blank" rel="noopener noreferrer">WhatsApp text ↗</a></div><div class="aero-share-downloads"></div><p class="aero-share-hint">If your app drops the caption, paste the copied text. For WhatsApp text, attach the downloaded image yourself.</p></div>`
  const find = selector => dialog.querySelector(selector), status = text => { find('.aero-share-status').textContent = text }
  find('textarea').value = model.text
  find('[data-whatsapp]').href = 'https://wa.me/?text=' + encodeURIComponent(model.text)
  find('[data-close]').onclick = () => dialog.close()
  const urls = []
  dialog.addEventListener('close', () => { urls.forEach(url => URL.revokeObjectURL(url)); dialog.remove(); if (activeDialog === dialog) activeDialog = null; if (focus?.isConnected) focus.focus({ preventScroll: true }) }, { once: true })
  find('[data-copy]').onclick = async () => {
    try { await navigator.clipboard.writeText(model.text); status('Text copied. Paste it with your image.') }
    catch { find('textarea').focus(); find('textarea').select(); status('Select and copy the message above.') }
  }
  document.body.append(dialog); dialog.showModal()
  try {
    const files = await createCards(model)
    if (!dialog.open) return
    urls.push(...files.map(file => URL.createObjectURL(file)))
    const image = document.createElement('img'); image.alt = `${model.tool} result card. All details are included in the images.`
    const preview = find('.aero-share-preview'); preview.replaceChildren(image); preview.setAttribute('aria-busy', 'false')
    let page = 0
    const render = () => { image.src = urls[page]; find('[data-page]').textContent = `Image ${page + 1} of ${files.length}`; find('[data-prev]').disabled = page === 0; find('[data-next]').disabled = page === files.length - 1 }
    find('[data-prev]').onclick = () => { page--; render() }; find('[data-next]').onclick = () => { page++; render() }
    find('.aero-share-pages').hidden = files.length === 1; render()
    files.forEach((file, i) => { const link = document.createElement('a'); link.href = urls[i]; link.download = file.name; link.textContent = files.length === 1 ? 'Download image' : `Download image ${i + 1}`; find('.aero-share-downloads').append(link) })
    const payload = imageSharePayload(navigator, files, model), button = find('[data-native]')
    button.hidden = !payload; button.disabled = !payload
    if (!payload) status('Download the image and use WhatsApp text to share your message.')
    // Images are prepared before this separate tap, preserving mobile user activation.
    button.onclick = async () => {
      button.disabled = true
      try { await navigator.share(payload); status('Share menu opened. Complete sharing in your chosen app.') }
      catch (error) { if (error.name !== 'AbortError') status('Sharing is unavailable. Download the image and copy the text below.') }
      finally { button.disabled = false }
    }
  } catch {
    find('.aero-share-preview').textContent = 'Image preview could not be created. You can still share the text.'
    find('.aero-share-preview').setAttribute('aria-busy', 'false'); find('[data-native]').hidden = true
  }
}
