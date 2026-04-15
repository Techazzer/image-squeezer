import { formatMimeFromParam } from '../lib/compressorEngine.js'

const DEFAULTS = {
  isEmbed: false,
  useTargetSize: false,
  targetSizeValue: 200,
  targetSizeUnit: 'KB',
  outputFormat: formatMimeFromParam('jpeg'),
  qualityPercent: 80,
  width: '',
  height: '',
  keepAspect: true,
  label: '',
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function parsePositiveInt(raw, min, max) {
  if (raw === null || raw === undefined || raw === '') return null
  const value = Number.parseInt(raw, 10)
  if (Number.isNaN(value) || value < min) return null
  return typeof max === 'number' ? Math.min(value, max) : value
}

function parseTargetValue(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  const value = Number.parseFloat(raw)
  if (Number.isNaN(value) || value <= 0) return null
  return clampNumber(value, 1, 500)
}

function parseUnit(raw) {
  if (raw === 'MB') return 'MB'
  if (raw === 'KB') return 'KB'
  return null
}

function parseKeepAspect(raw) {
  if (raw === '0') return false
  if (raw === '1') return true
  return null
}

export function getEmbedDefaults() {
  return { ...DEFAULTS }
}

export function parseEmbedConfig(search = '') {
  const params = new URLSearchParams(search)
  const isEmbed = params.get('embed') === '1'

  if (!isEmbed) {
    return getEmbedDefaults()
  }

  const next = {
    ...DEFAULTS,
    isEmbed,
  }

  const targetValue = parseTargetValue(params.get('target'))
  const targetUnit = parseUnit(params.get('unit'))
  if (targetValue !== null) {
    next.useTargetSize = true
    next.targetSizeValue = targetValue
    next.targetSizeUnit = targetUnit || DEFAULTS.targetSizeUnit
  }

  const format = params.get('format')
  if (format) {
    next.outputFormat = formatMimeFromParam(format)
  }

  const quality = parsePositiveInt(params.get('quality'), 1, 100)
  if (quality !== null && !next.useTargetSize) {
    next.qualityPercent = quality
  }

  const width = parsePositiveInt(params.get('width'), 1, 10000)
  if (width !== null) {
    next.width = String(width)
  }

  const height = parsePositiveInt(params.get('height'), 1, 10000)
  if (height !== null) {
    next.height = String(height)
  }

  const keepAspect = parseKeepAspect(params.get('keepAspect'))
  if (keepAspect !== null) {
    next.keepAspect = keepAspect
  }

  const rawLabel = params.get('label')
  if (rawLabel) {
    next.label = rawLabel.trim().slice(0, 120)
  }

  return next
}
