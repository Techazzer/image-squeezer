// Prepare attachments before the tap so native sharing retains user activation.
export function createDirectShare({ load, navigator, openWhatsApp, downloadFile, onEvent = () => {} }) {
  let version = 0, prepared = null, busy = false
  return {
    async prepare(data) {
      const request = ++version
      prepared = null
      if (!data) return false
      const module = await load()
      const next = await module.prepareResultShare(data)
      if (request !== version) return false
      prepared = next
      return true
    },
    get ready() { return !!prepared && !busy },
    get hasAttachment() { return !!prepared?.payload },
    get readyNote() {
      if (prepared?.payload) return 'Choose WhatsApp from your phone’s share menu.'
      return prepared?.download ? 'File sharing is unavailable here. Tap to download, then attach the file in WhatsApp.' : 'This browser shares the full summary on WhatsApp as text.'
    },
    send(report) {
      if (!prepared || busy) return Promise.resolve()
      const current = prepared
      onEvent('share_open')
      if (!current.payload) {
        if (current.download) {
          try { downloadFile(current.download); onEvent('share_fallback',{action:'file'}); report('Download started. Attach this file in WhatsApp.') }
          catch { report('Download could not start. Use the tool’s Download button to save your file.') }
        } else {openWhatsApp(current.model.fullText);onEvent('share_fallback',{action:'whatsapp'})}
        return Promise.resolve()
      }
      busy = true
      let operation
      try { operation = navigator.share(current.payload) }
      catch (error) { operation = Promise.reject(error) }
      return Promise.resolve(operation).then(() => {onEvent('share_complete',{action:'native'});report('')}, error => {
        if(error?.name==='AbortError'){onEvent('share_cancel');return}
        if(prepared!==current)return
        onEvent('tool_error',{error_code:'share_unavailable'})
        current.payload = null
        report(current.download ? 'File sharing is unavailable. Tap again to download the file, then attach it in WhatsApp.' : 'Image sharing is unavailable. Tap again to send the full summary on WhatsApp.')
      }).finally(() => { busy = false })
    }
  }
}

export function installResultSharing(load) {
  const entries = new WeakMap()
  const downloadFile = file => {
    const url = URL.createObjectURL(file), link = document.createElement('a')
    link.href = url; link.download = file.name
    document.body.append(link); link.click(); link.remove()
    setTimeout(() => URL.revokeObjectURL(url),10000)
  }
  const setNote = (button, text) => {
    let note = button.parentElement.querySelector('.aero-share-note')
    if (!note && !text) return
    if (!note) { note = document.createElement('p'); note.className = 'aero-share-note'; note.setAttribute('role','status'); button.insertAdjacentElement('afterend',note) }
    if (note.textContent !== text) note.textContent = text
    note.hidden = !text
  }
  const sync = button => {
    const key = button.dataset.aeroShare || ''
    let entry = entries.get(button)
    if (!entry) {
      entry = { key: null, timer: null, controller: createDirectShare({ load, navigator, downloadFile, onEvent:(event,data)=>window.aeroTrack?.(event,data), openWhatsApp: text => window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer') }) }
      entries.set(button,entry)
      button.addEventListener('click', () => {
        if (entry.key !== button.dataset.aeroShare || !entry.controller.ready) return
        const operation = entry.controller.send(text => setNote(button,text))
        button.disabled = !entry.controller.ready
        operation.finally(() => { button.disabled = !entry.controller.ready })
      })
    }
    if (entry.key === key) { button.disabled = !entry.controller.ready; return }
    entry.key = key; clearTimeout(entry.timer)
    entry.controller.prepare(null)
    button.disabled = true
    if (!key) { setNote(button,''); return }
    setNote(button,'Preparing your share…')
    entry.timer = setTimeout(async () => {
      try {
        const ready = await entry.controller.prepare(JSON.parse(key))
        if (!ready || entry.key !== key || !button.isConnected) return
        button.disabled = !entry.controller.ready
        setNote(button,entry.controller.readyNote)
      } catch {
        if (entry.key === key) setNote(button,'Sharing is unavailable. Create the result again or use the tool’s Download button.')
      }
    },150)
  }
  const scan = () => document.querySelectorAll('[data-aero-share], [data-share-control]').forEach(sync)
  new MutationObserver(scan).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-aero-share']})
  scan()
}
