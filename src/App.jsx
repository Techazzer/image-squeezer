import { useState, useRef, useCallback } from 'react'
import './App.css'

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function getSavingsPercent(original, compressed) {
  if (!original || !compressed) return 0
  return Math.round((1 - compressed / original) * 100)
}

function canvasToBlob(canvas, format, q) {
  return new Promise((resolve) => canvas.toBlob(resolve, format, q))
}

async function binarySearchQuality(canvas, format, targetBytes) {
  // Check if even quality=1.0 is under target — no compression needed
  const maxBlob = await canvasToBlob(canvas, format, 1.0)
  if (maxBlob.size <= targetBytes) return maxBlob

  // Check if quality=0.01 is still over target — can't reach target
  const minBlob = await canvasToBlob(canvas, format, 0.01)
  if (minBlob.size > targetBytes) return { blob: minBlob, unreachable: true }

  let lo = 0.01
  let hi = 1.0
  let bestBlob = minBlob

  for (let i = 0; i < 16; i++) {
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

const QUALITY_PRESETS = [
  { label: 'Low', value: 0.3, description: 'Smallest file' },
  { label: 'Medium', value: 0.6, description: 'Balanced' },
  { label: 'High', value: 0.8, description: 'Good quality' },
  { label: 'Max', value: 1.0, description: 'No compression' },
]

export default function App() {
  const [image, setImage] = useState(null)
  const [originalSize, setOriginalSize] = useState(0)
  const [compressed, setCompressed] = useState(null)
  const [compressedSize, setCompressedSize] = useState(0)
  const [quality, setQuality] = useState(0.8)
  const [customQuality, setCustomQuality] = useState(80)
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [keepAspect, setKeepAspect] = useState(true)
  const [originalDims, setOriginalDims] = useState({ w: 0, h: 0 })
  const [outputFormat, setOutputFormat] = useState('image/jpeg')
  const [isDragging, setIsDragging] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [activePreset, setActivePreset] = useState(2)
  const [useTargetSize, setUseTargetSize] = useState(false)
  const [targetSizeValue, setTargetSizeValue] = useState(200)
  const [targetSizeUnit, setTargetSizeUnit] = useState('KB')
  const [sizeWarning, setSizeWarning] = useState('')
  const fileInputRef = useRef()

  const processImage = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        setImage(e.target.result)
        setOriginalSize(file.size)
        setOriginalDims({ w: img.naturalWidth, h: img.naturalHeight })
        setWidth(img.naturalWidth)
        setHeight(img.naturalHeight)
        setCompressed(null)
        setCompressedSize(0)
        setSizeWarning('')
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  }, [])

  const handleFile = (e) => processImage(e.target.files[0])

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    processImage(e.dataTransfer.files[0])
  }

  const handleWidthChange = (val) => {
    setWidth(val)
    if (keepAspect && originalDims.w) {
      setHeight(Math.round(val * (originalDims.h / originalDims.w)))
    }
  }

  const handleHeightChange = (val) => {
    setHeight(val)
    if (keepAspect && originalDims.h) {
      setWidth(Math.round(val * (originalDims.w / originalDims.h)))
    }
  }

  const handleQualitySlider = (val) => {
    const q = parseInt(val)
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

  const getCanvas = () => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const targetW = parseInt(width) || originalDims.w
        const targetH = parseInt(height) || originalDims.h
        canvas.width = targetW
        canvas.height = targetH
        canvas.getContext('2d').drawImage(img, 0, 0, targetW, targetH)
        resolve(canvas)
      }
      img.src = image
    })
  }

  const compress = async () => {
    if (!image) return
    setProcessing(true)
    setSizeWarning('')

    const canvas = await getCanvas()

    let blob
    if (useTargetSize) {
      const multiplier = targetSizeUnit === 'MB' ? 1024 * 1024 : 1024
      const targetBytes = parseFloat(targetSizeValue) * multiplier
      if (!targetBytes || targetBytes <= 0) {
        setSizeWarning('Please enter a valid target size.')
        setProcessing(false)
        return
      }
      const result = await binarySearchQuality(canvas, outputFormat, targetBytes)
      // Handle both shapes: plain blob (quality=1 case) or { blob, unreachable }
      if (result instanceof Blob) {
        blob = result
      } else {
        blob = result.blob
        if (result.unreachable) {
          setSizeWarning(
            `Could not reach ${targetSizeValue} ${targetSizeUnit} — minimum achievable is ${formatBytes(blob.size)}.`
          )
        }
      }
    } else {
      blob = await canvasToBlob(canvas, outputFormat, quality)
    }

    const url = URL.createObjectURL(blob)
    setCompressed(url)
    setCompressedSize(blob.size)
    setProcessing(false)
  }

  const download = () => {
    if (!compressed) return
    const ext = outputFormat === 'image/jpeg' ? 'jpg' : outputFormat === 'image/png' ? 'png' : 'webp'
    const a = document.createElement('a')
    a.href = compressed
    a.download = `compressed.${ext}`
    a.click()
  }

  const reset = () => {
    setImage(null)
    setCompressed(null)
    setOriginalSize(0)
    setCompressedSize(0)
    setOriginalDims({ w: 0, h: 0 })
    setWidth('')
    setHeight('')
    setSizeWarning('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const savings = getSavingsPercent(originalSize, compressedSize)

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo-wrap">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">ImageSqueeze</span>
          </div>
          <p className="tagline">Compress & resize images instantly — 100% in your browser</p>
        </div>
      </header>

      <main className="main">
        {!image && (
          <div
            className={`dropzone ${isDragging ? 'dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
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
            <p className="dropzone-sub">or <span className="link">click to browse</span></p>
            <p className="dropzone-hint">Supports JPG, PNG, WebP, GIF, BMP</p>
          </div>
        )}

        {image && (
          <div className="workspace">
            <div className="panel controls-panel">
              <div className="panel-header">
                <h2>Settings</h2>
                <button className="btn-ghost" onClick={reset}>↩ Change image</button>
              </div>

              {/* Compression Section */}
              <section className="control-section">
                <h3 className="section-title">
                  <span>🎯</span> Compression Quality
                </h3>

                <div className={`quality-presets ${useTargetSize ? 'disabled' : ''}`}>
                  {QUALITY_PRESETS.map((p, i) => (
                    <button
                      key={i}
                      className={`preset-btn ${activePreset === i ? 'active' : ''}`}
                      onClick={() => { if (!useTargetSize) applyPreset(i) }}
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

                {/* Target Size Row */}
                <div className="target-row">
                  <label className="target-toggle-label">
                    <div className={`toggle-switch ${useTargetSize ? 'on' : ''}`} onClick={() => { setUseTargetSize(v => !v); setSizeWarning('') }}>
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
                      >KB</button>
                      <button
                        className={`unit-btn ${targetSizeUnit === 'MB' ? 'active' : ''}`}
                        onClick={() => useTargetSize && setTargetSizeUnit('MB')}
                        disabled={!useTargetSize}
                      >MB</button>
                    </div>
                  </div>
                </div>
                {sizeWarning && <div className="size-warning">{sizeWarning}</div>}
              </section>

              {/* Resize Section */}
              <section className="control-section">
                <h3 className="section-title">
                  <span>📐</span> Resize Dimensions
                </h3>
                <p className="original-dims">Original: {originalDims.w} × {originalDims.h} px</p>
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

              {/* Format Section */}
              <section className="control-section">
                <h3 className="section-title">
                  <span>📄</span> Output Format
                </h3>
                <div className="format-btns">
                  {[
                    { mime: 'image/jpeg', label: 'JPEG', note: 'Best compression' },
                    { mime: 'image/png', label: 'PNG', note: 'Lossless' },
                    { mime: 'image/webp', label: 'WebP', note: 'Modern' },
                  ].map((f) => (
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

              <button
                className="btn-compress"
                onClick={compress}
                disabled={processing}
              >
                {processing ? (
                  <><span className="spinner" /> Processing…</>
                ) : (
                  <>⚡ Compress & Resize</>
                )}
              </button>
            </div>

            {/* Preview Panel */}
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
                  <div className="preview-dims">{originalDims.w} × {originalDims.h} px</div>
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
                    {compressedSize > 0 && (
                      <span className="size-badge green">{formatBytes(compressedSize)}</span>
                    )}
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
                    <div className="preview-dims">{width} × {height} px</div>
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
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        All processing happens locally in your browser — no uploads, no servers.
      </footer>
    </div>
  )
}
