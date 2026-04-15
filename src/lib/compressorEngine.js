export const OUTPUT_FORMATS = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

const QUALITY_SEARCH_MIN = 0.01
const QUALITY_SEARCH_MAX = 1.0
const QUALITY_SEARCH_STEPS = 16

export function formatMimeFromParam(formatParam = 'jpeg') {
  const key = String(formatParam).toLowerCase()
  return OUTPUT_FORMATS[key] || OUTPUT_FORMATS.jpeg
}

export function formatParamFromMime(mime = OUTPUT_FORMATS.jpeg) {
  const entry = Object.entries(OUTPUT_FORMATS).find(([, value]) => value === mime)
  return entry ? entry[0] : 'jpeg'
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function getSavingsPercent(original, compressed) {
  if (!original || !compressed) return 0
  return Math.round((1 - compressed / original) * 100)
}

export function canvasToBlob(canvas, format, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Unable to encode image from canvas'))
        return
      }
      resolve(blob)
    }, format, quality)
  })
}

export async function binarySearchQuality(canvas, format, targetBytes) {
  const maxBlob = await canvasToBlob(canvas, format, QUALITY_SEARCH_MAX)
  if (maxBlob.size <= targetBytes) return { blob: maxBlob, unreachable: false }

  const minBlob = await canvasToBlob(canvas, format, QUALITY_SEARCH_MIN)
  if (minBlob.size > targetBytes) return { blob: minBlob, unreachable: true }

  let lo = QUALITY_SEARCH_MIN
  let hi = QUALITY_SEARCH_MAX
  let bestBlob = minBlob

  for (let i = 0; i < QUALITY_SEARCH_STEPS; i += 1) {
    const mid = (lo + hi) / 2
    const blob = await canvasToBlob(canvas, format, mid)
    if (blob.size <= targetBytes) {
      bestBlob = blob
      lo = mid
    } else {
      hi = mid
    }
  }

  return { blob: bestBlob, unreachable: false }
}

export async function compressCanvas({ canvas, outputFormat, quality, targetBytes }) {
  if (targetBytes) {
    return binarySearchQuality(canvas, outputFormat, targetBytes)
  }

  const blob = await canvasToBlob(canvas, outputFormat, quality)
  return { blob, unreachable: false }
}

export async function drawImageToCanvas({ imageSrc, width, height, fallbackWidth, fallbackHeight }) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const targetW = Number.parseInt(width, 10) || fallbackWidth
      const targetH = Number.parseInt(height, 10) || fallbackHeight
      canvas.width = targetW
      canvas.height = targetH
      canvas.getContext('2d').drawImage(img, 0, 0, targetW, targetH)
      resolve(canvas)
    }
    img.src = imageSrc
  })
}
