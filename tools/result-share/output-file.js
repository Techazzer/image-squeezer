import { fileSharePayload } from './model.js'

const OUTPUT_TYPES = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

// Read only a completed, local output. Never fetch an uploaded document from a
// server or add its contents, filename or compression statistics to the message.
export async function prepareOutputShare(data, { fetchFile = fetch, origin = location.origin, shareNavigator = navigator } = {}) {
  const url = new URL(data.url)
  if (url.protocol !== 'blob:' || url.origin !== origin || !['pdf','image'].includes(data.tool)) throw Error('A local output file is required.')
  const response = await fetchFile(url.href)
  if (!response.ok) throw Error('The output is no longer available.')
  const blob = await response.blob()
  const extension = OUTPUT_TYPES[blob.type]
  if (!blob.size || !extension || (data.tool === 'pdf') !== (extension === 'pdf')) throw Error('The output has an unsupported format.')
  // Use the actual output MIME type, even if the format selector has since changed.
  const base = String(data.filename || 'compressed').replace(/\.[^.]*$/, '').replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g,'_').slice(0,160).trim() || 'compressed'
  const file = new File([blob], `${base}.${extension}`, { type: blob.type })
  const path = data.tool === 'pdf' ? '/pdf-compress/' : '/image-compressor/'
  const text = `Made with Aeroniqx\nhttps://aeroniqx.in${path}`
  const model = { title: 'Made with Aeroniqx', text, fullText: text }
  return { model, payload: fileSharePayload(shareNavigator, [file], model), download: file }
}
