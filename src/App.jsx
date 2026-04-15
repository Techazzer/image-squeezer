import { useMemo, useRef, useState, useCallback } from 'react'
import PropTypes from 'prop-types'
import './App.css'
import { parseEmbedConfig } from './config/embedConfig'
import {
  compressCanvas,
  drawImageToCanvas,
  formatBytes,
  getSavingsPercent,
  OUTPUT_FORMATS,
} from './lib/compressorEngine'

const AD_SLOTS = {
  heroBanner: null,
  controlsInline: null,
  resultsFooter: null,
  footerBanner: null,
}

const QUALITY_PRESETS = [
  { label: 'Low', value: 0.3, description: 'Smallest file' },
  { label: 'Medium', value: 0.6, description: 'Balanced' },
  { label: 'High', value: 0.8, description: 'Good quality' },
  { label: 'Max', value: 1.0, description: 'No compression' },
]

const FORMAT_OPTIONS = [
  { mime: OUTPUT_FORMATS.jpeg, label: 'JPEG', note: 'Best compression' },
  { mime: OUTPUT_FORMATS.png, label: 'PNG', note: 'Lossless' },
  { mime: OUTPUT_FORMATS.webp, label: 'WebP', note: 'Modern' },
]

function AdPlaceholder({ slot, label, compact = false }) {
  if (!slot) return null

  return (
    <section className={`ad-slot ${compact ? 'compact' : ''}`} aria-label="ad placeholder">
      <div className="ad-slot-header">
        <span className="ad-slot-badge">Ad space</span>
        <span className="ad-slot-name">{label}</span>
      </div>
      <div className="ad-slot-box">
        <span className="ad-slot-code">{`data-ad-slot=""`}</span>
        <span className="ad-slot-help">Replace this placeholder with your AdSense unit later.</span>
      </div>
    </section>
  )
}

AdPlaceholder.propTypes = {
  slot: PropTypes.string,
  label: PropTypes.string.isRequired,
  compact: PropTypes.bool,
}

function getInitialConfig() {
  if (typeof window === 'undefined') {
    return parseEmbedConfig('')
  }
  return parseEmbedConfig(window.location.search)
}

export default function App() {
  const initialConfig = useMemo(getInitialConfig, [])

  const [image, setImage] = useState(null)
  const [originalSize, setOriginalSize] = useState(0)
  const [compressed, setCompressed] = useState(null)
  const [compressedSize, setCompressedSize] = useState(0)
  const [quality, setQuality] = useState(initialConfig.qualityPercent / 100)
  const [customQuality, setCustomQuality] = useState(initialConfig.qualityPercent)
  const [width, setWidth] = useState(initialConfig.width)
  const [height, setHeight] = useState(initialConfig.height)
  const [keepAspect, setKeepAspect] = useState(initialConfig.keepAspect)
  const [originalDims, setOriginalDims] = useState({ w: 0, h: 0 })
  const [outputFormat, setOutputFormat] = useState(initialConfig.outputFormat)
  const [isDragging, setIsDragging] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [activePreset, setActivePreset] = useState(
    QUALITY_PRESETS.findIndex((p) => Math.round(p.value * 100) === initialConfig.qualityPercent)
  )
  const [useTargetSize, setUseTargetSize] = useState(initialConfig.useTargetSize)
  const [targetSizeValue, setTargetSizeValue] = useState(initialConfig.targetSizeValue)
  const [targetSizeUnit, setTargetSizeUnit] = useState(initialConfig.targetSizeUnit)
  const [sizeWarning, setSizeWarning] = useState('')
  const fileInputRef = useRef()

  const processImage = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const src = e.target?.result
      if (!src) return
      const img = new Image()
      img.onload = () => {
        setImage(src)
        setOriginalSize(file.size)
        setOriginalDims({ w: img.naturalWidth, h: img.naturalHeight })
        setWidth((prev) => (prev ? prev : String(img.naturalWidth)))
        setHeight((prev) => (prev ? prev : String(img.naturalHeight)))
        setCompressed((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return null
        })
        setCompressedSize(0)
        setSizeWarning('')
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  }, [])

  const handleFile = (e) => processImage(e.target.files?.[0])

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    processImage(e.dataTransfer.files?.[0])
  }

  const handleWidthChange = (val) => {
    setWidth(val)
    if (keepAspect && originalDims.w) {
      const nextWidth = Number.parseInt(val, 10)
      if (!Number.isNaN(nextWidth)) {
        setHeight(String(Math.round(nextWidth * (originalDims.h / originalDims.w))))
      }
    }
  }

  const handleHeightChange = (val) => {
    setHeight(val)
    if (keepAspect && originalDims.h) {
      const nextHeight = Number.parseInt(val, 10)
      if (!Number.isNaN(nextHeight)) {
        setWidth(String(Math.round(nextHeight * (originalDims.w / originalDims.h))))
      }
    }
  }

  const handleQualitySlider = (val) => {
    const q = Number.parseInt(val, 10)
    setCustomQuality(q)
    setQuality(q / 100)
    setActivePreset(null)
  }

  const applyPreset = (idx) => {
    setActivePreset(idx)
    const q = QUALITY_PRESETS[idx].value
    setQuality(q)
    setCustomQuality(Math.round(q * 100))
  }

  const compress = async () => {
    if (!image) return

    setProcessing(true)
    setSizeWarning('')

    try {
      const canvas = await drawImageToCanvas({
        imageSrc: image,
        width,
        height,
        fallbackWidth: originalDims.w,
        fallbackHeight: originalDims.h,
      })

      let targetBytes = null
      if (useTargetSize) {
        const multiplier = targetSizeUnit === 'MB' ? 1024 * 1024 : 1024
        const parsedTarget = Number.parseFloat(targetSizeValue)
        targetBytes = parsedTarget * multiplier
        if (!targetBytes || targetBytes <= 0) {
          setSizeWarning('Please enter a valid target size.')
          setProcessing(false)
          return
        }
      }

      const { blob, unreachable } = await compressCanvas({
        canvas,
        outputFormat,
        quality,
        targetBytes,
      })

      if (unreachable) {
        setSizeWarning(
          `Could not reach ${targetSizeValue} ${targetSizeUnit} — minimum achievable is ${formatBytes(blob.size)}.`
        )
      }

      setCompressed((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(blob)
      })
      setCompressedSize(blob.size)
    } finally {
      setProcessing(false)
    }
  }

  const download = () => {
    if (!compressed) return
    const ext = outputFormat === OUTPUT_FORMATS.jpeg ? 'jpg' : outputFormat === OUTPUT_FORMATS.png ? 'png' : 'webp'
    const a = document.createElement('a')
    a.href = compressed
    a.download = `compressed.${ext}`
    a.click()
  }

  const reset = () => {
    setImage(null)
    setCompressed((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setOriginalSize(0)
    setCompressedSize(0)
    setOriginalDims({ w: 0, h: 0 })
    setWidth(initialConfig.width)
    setHeight(initialConfig.height)
    setQuality(initialConfig.qualityPercent / 100)
    setCustomQuality(initialConfig.qualityPercent)
    setOutputFormat(initialConfig.outputFormat)
    setKeepAspect(initialConfig.keepAspect)
    setUseTargetSize(initialConfig.useTargetSize)
    setTargetSizeValue(initialConfig.targetSizeValue)
    setTargetSizeUnit(initialConfig.targetSizeUnit)
    setSizeWarning('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const savings = getSavingsPercent(originalSize, compressedSize)

  const modeClass = initialConfig.isEmbed ? 'app embed-mode' : 'app'

  return (
    <div className={modeClass}>
      {!initialConfig.isEmbed && (
        <header className="header">
          <div className="header-inner">
            <div className="logo-wrap">
              <span className="logo-icon">⚡</span>
              <span className="logo-text">ImageSqueeze</span>
            </div>
            <p className="tagline">Compress & resize images instantly — 100% in your browser</p>
          </div>
        </header>
      )}

      <main className="main">
        {initialConfig.isEmbed && (
          <section className="embed-intro-card">
            <div className="embed-intro-top">
              <span className="embed-badge">Embedded Tool</span>
              {initialConfig.label && <span className="embed-label">{initialConfig.label}</span>}
            </div>
            <p className="embed-privacy">Private by design: all processing happens locally in your browser.</p>
            <div className="trust-chips">
              <span className="trust-chip">No Uploads</span>
              <span className="trust-chip">No Sign-up</span>
              <span className="trust-chip">Fast Local Processing</span>
            </div>
          </section>
        )}

        {AD_SLOTS.heroBanner && !initialConfig.isEmbed && (
          <AdPlaceholder slot={AD_SLOTS.heroBanner} label="Top banner" compact />
        )}

        {!image && (
          <div
            className={`dropzone ${isDragging ? 'dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              style={{ display: 'none' }}
            />
            <div className="dropzone-icon">🖼️</div>
            <p className="dropzone-title">Drop your image here</p>
            <p className="dropzone-sub">
              or <span className="link">click to browse</span>
            </p>
            <p className="dropzone-hint">Supports JPG, PNG, WebP, GIF, BMP</p>
          </div>
        )}

        {image && (
          <div className="workspace">
            <div className="panel controls-panel">
              <div className="panel-header">
                <h2>Settings</h2>
                <button className="btn-ghost" onClick={reset}>
                  ↩ Change image
                </button>
              </div>

              {AD_SLOTS.controlsInline && !initialConfig.isEmbed && (
                <div className="panel-ad-wrap">
                  <AdPlaceholder slot={AD_SLOTS.controlsInline} label="Inline settings ad" compact />
                </div>
              )}

              <section className="control-section">
                <h3 className="section-title">
                  <span>🎯</span> Compression Quality
                </h3>

                <div className={`quality-presets ${useTargetSize ? 'disabled' : ''}`}>
                  {QUALITY_PRESETS.map((p, i) => (
                    <button
                      key={p.label}
                      className={`preset-btn ${activePreset === i ? 'active' : ''}`}
                      onClick={() => {
                        if (!useTargetSize) applyPreset(i)
                      }}
                      disabled={useTargetSize}
                    >
                      <span className="preset-label">{p.label}</span>
                      <span className="preset-desc">{p.description}</span>
                    </button>
                  ))}
                </div>

                <div className={`quality-slider-wrap ${useTargetSize ? 'disabled' : ''}`}>
                  <div className="slider-top">
                    <span className="slider-hint">Smaller file</span>
                    <span className="quality-value">{customQuality}%</span>
                    <span className="slider-hint">Better quality</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={customQuality}
                    onChange={(e) => handleQualitySlider(e.target.value)}
                    className="quality-slider"
                    style={{ '--value': customQuality }}
                    disabled={useTargetSize}
                  />
                </div>

                <div className="target-row">
                  <label className="target-toggle-label">
                    <div
                      className={`toggle-switch ${useTargetSize ? 'on' : ''}`}
                      onClick={() => {
                        setUseTargetSize((v) => !v)
                        setSizeWarning('')
                      }}
                    >
                      <div className="toggle-knob" />
                    </div>
                    <span>Target file size</span>
                  </label>
                  <div className={`target-inline ${useTargetSize ? 'active' : ''}`}>
                    <div className="input-unit target-input">
                      <input
                        type="number"
                        value={targetSizeValue}
                        onChange={(e) => setTargetSizeValue(e.target.value)}
                        min="1"
                        placeholder="200"
                        disabled={!useTargetSize}
                      />
                    </div>
                    <div className="unit-toggle">
                      <button
                        className={`unit-btn ${targetSizeUnit === 'KB' ? 'active' : ''}`}
                        onClick={() => useTargetSize && setTargetSizeUnit('KB')}
                        disabled={!useTargetSize}
                      >
                        KB
                      </button>
                      <button
                        className={`unit-btn ${targetSizeUnit === 'MB' ? 'active' : ''}`}
                        onClick={() => useTargetSize && setTargetSizeUnit('MB')}
                        disabled={!useTargetSize}
                      >
                        MB
                      </button>
                    </div>
                  </div>
                </div>
                {sizeWarning && <div className="size-warning">{sizeWarning}</div>}
              </section>

              <section className="control-section">
                <h3 className="section-title">
                  <span>📐</span> Resize Dimensions
                </h3>
                <p className="original-dims">
                  Original: {originalDims.w} × {originalDims.h} px
                </p>
                <div className="dims-row">
                  <div className="dim-field">
                    <label>Width</label>
                    <div className="input-unit">
                      <input
                        type="number"
                        value={width}
                        onChange={(e) => handleWidthChange(e.target.value)}
                        min="1"
                        max="10000"
                      />
                      <span className="unit">px</span>
                    </div>
                  </div>
                  <button
                    className={`aspect-btn ${keepAspect ? 'locked' : 'unlocked'}`}
                    onClick={() => setKeepAspect(!keepAspect)}
                    title={keepAspect ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
                  >
                    {keepAspect ? '🔗' : '🔓'}
                  </button>
                  <div className="dim-field">
                    <label>Height</label>
                    <div className="input-unit">
                      <input
                        type="number"
                        value={height}
                        onChange={(e) => handleHeightChange(e.target.value)}
                        min="1"
                        max="10000"
                      />
                      <span className="unit">px</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="control-section">
                <h3 className="section-title">
                  <span>📄</span> Output Format
                </h3>
                <div className="format-btns">
                  {FORMAT_OPTIONS.map((f) => (
                    <button
                      key={f.mime}
                      className={`format-btn ${outputFormat === f.mime ? 'active' : ''}`}
                      onClick={() => setOutputFormat(f.mime)}
                    >
                      <span className="format-name">{f.label}</span>
                      <span className="format-note">{f.note}</span>
                    </button>
                  ))}
                </div>
              </section>

              <button className="btn-compress" onClick={compress} disabled={processing}>
                {processing ? (
                  <>
                    <span className="spinner" /> Processing…
                  </>
                ) : (
                  <>⚡ Compress & Resize</>
                )}
              </button>
            </div>

            <div className="panel preview-panel">
              <div className="previews">
                <div className="preview-card">
                  <div className="preview-label">
                    <span className="preview-title">Original</span>
                    <span className="size-badge">{formatBytes(originalSize)}</span>
                  </div>
                  <div className="preview-img-wrap">
                    <img src={image} alt="original" />
                  </div>
                  <div className="preview-dims">
                    {originalDims.w} × {originalDims.h} px
                  </div>
                </div>

                <div className="arrow-col">
                  <div className="arrow-icon">→</div>
                  {compressedSize > 0 && (
                    <div className={`savings-badge ${savings >= 0 ? 'positive' : 'negative'}`}>
                      {savings >= 0 ? `−${savings}%` : `+${Math.abs(savings)}%`}
                    </div>
                  )}
                </div>

                <div className="preview-card">
                  <div className="preview-label">
                    <span className="preview-title">Compressed</span>
                    {compressedSize > 0 && <span className="size-badge green">{formatBytes(compressedSize)}</span>}
                  </div>
                  <div className="preview-img-wrap">
                    {compressed ? (
                      <img src={compressed} alt="compressed" />
                    ) : (
                      <div className="preview-placeholder">
                        <span>Result will appear here</span>
                      </div>
                    )}
                  </div>
                  {compressedSize > 0 && (
                    <div className="preview-dims">
                      {width} × {height} px
                    </div>
                  )}
                </div>
              </div>

              {compressedSize > 0 && (
                <div className="stats-bar">
                  <div className="stat">
                    <span className="stat-label">Original</span>
                    <span className="stat-val">{formatBytes(originalSize)}</span>
                  </div>
                  <div className="stat-divider" />
                  <div className="stat">
                    <span className="stat-label">Compressed</span>
                    <span className="stat-val">{formatBytes(compressedSize)}</span>
                  </div>
                  <div className="stat-divider" />
                  <div className="stat">
                    <span className="stat-label">Space saved</span>
                    <span className={`stat-val ${savings > 0 ? 'green' : 'red'}`}>
                      {formatBytes(Math.abs(originalSize - compressedSize))}
                    </span>
                  </div>
                  <div className="stat-divider" />
                  <div className="stat">
                    <span className="stat-label">Reduction</span>
                    <span className={`stat-val ${savings > 0 ? 'green' : 'red'}`}>
                      {savings >= 0 ? `−${savings}%` : `+${Math.abs(savings)}%`}
                    </span>
                  </div>
                </div>
              )}

              {compressed && (
                <button className="btn-download" onClick={download}>
                  ⬇ Download Compressed Image
                </button>
              )}

              {AD_SLOTS.resultsFooter && !initialConfig.isEmbed && (
                <div className="panel-ad-wrap panel-ad-wrap-bottom">
                  <AdPlaceholder slot={AD_SLOTS.resultsFooter} label="Results footer ad" compact />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {!initialConfig.isEmbed && (
        <footer className="footer">
          {AD_SLOTS.footerBanner && <AdPlaceholder slot={AD_SLOTS.footerBanner} label="Footer banner" compact />}
          All processing happens locally in your browser — no uploads, no servers.
        </footer>
      )}
    </div>
  )
}
