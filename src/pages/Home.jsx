import { Link } from 'react-router-dom'
import ToolCard from '../components/ToolCard'
import AdSlot from '../components/AdSlot'
import './Home.css'

// ─── Hero mockup visual ───────────────────────────────────────────────────────
function HeroVisual() {
  return (
    <div className="hero-visual">
      {/* Floating badge: image result */}
      <div className="hero-float hero-float--result">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" fill="#34a853"/>
          <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span>48 KB saved!</span>
      </div>
      {/* Floating badge: PDF result */}
      <div className="hero-float hero-float--pdf">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" fill="#ea4335"/>
          <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span>1.2 MB → 180 KB</span>
      </div>
      {/* Floating badge: privacy */}
      <div className="hero-float hero-float--privacy">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M8 1L2 4v4c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5V4L8 1z" fill="#1a73e8" opacity=".2" stroke="#1a73e8" strokeWidth="1.4"/>
        </svg>
        <span>100% private</span>
      </div>
      {/* Floating badge: format */}
      <div className="hero-float hero-float--format">
        <span className="hero-float-formats">
          <b>JPG</b> <b>PNG</b> <b>PDF</b>
        </span>
      </div>

      {/* Browser mockup */}
      <div className="hero-mockup">
        <div className="mockup-chrome">
          <div className="mockup-dots"><span/><span/><span/></div>
          <div className="mockup-url">aeroniqx.in/pdf-compress</div>
        </div>
        <div className="mockup-body">
          <div className="mockup-drop">
            <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="8" fill="#fce8e6"/>
              <rect x="11" y="8" width="14" height="18" rx="2" fill="#ea4335" opacity=".25"/>
              <rect x="11" y="8" width="14" height="18" rx="2" stroke="#ea4335" strokeWidth="1.2"/>
              <path d="M15 16h6M15 19h4" stroke="#ea4335" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M22 8v5h5" fill="none" stroke="#ea4335" strokeWidth="1.2"/>
              <path d="M22 8l5 5" fill="none" stroke="#ea4335" strokeWidth="1.2"/>
            </svg>
            <p className="mockup-drop-text">Drop PDF here</p>
            <span className="mockup-drop-hint">PDF · Any size · No upload</span>
          </div>
          <div className="mockup-result">
            <div className="mockup-file-row">
              <div className="mockup-file-name">report.pdf</div>
              <div className="mockup-file-size mockup-file-size--before">1.2 MB</div>
            </div>
            <div className="mockup-arrow">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v12M4 10l4 4 4-4" stroke="#ea4335" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Compressed</span>
            </div>
            <div className="mockup-file-row">
              <div className="mockup-file-name">report.pdf</div>
              <div className="mockup-file-size mockup-file-size--after">180 KB ✓</div>
            </div>
          </div>
          <button className="mockup-btn mockup-btn--pdf">⬇ Download (180 KB)</button>
        </div>
      </div>
    </div>
  )
}

// ─── Data ────────────────────────────────────────────────────────────────────
const TOOL_CATEGORIES = [
  {
    id: 'image',
    label: '🖼️ Image Tools',
    desc: 'Compress, resize, and convert images — all in your browser.',
    tools: [
      { icon: '🗜️', title: 'Image Compressor',     desc: 'Compress to any KB target. JPEG, PNG, WebP, BMP.', href: '/image-compressor/', badge: 'Popular' },
      { icon: '📏', title: 'Compress to 50KB',      desc: 'Railway, SSC, UPSC, and govt exam portals.',       href: '/compress-image-to-50kb/', isExternal: true },
      { icon: '📏', title: 'Compress to 100KB',     desc: 'Naukri, LinkedIn, HR portals.',                    href: '/compress-image-to-100kb/', isExternal: true },
      { icon: '📏', title: 'Compress to 200KB',     desc: 'UPSC OTR, Passport Seva, NTA.',                    href: '/compress-image-to-200kb/', isExternal: true },
      { icon: '📉', title: 'MB to KB',              desc: 'Reduce 5MB+ photos to under 200KB instantly.',     href: '/reduce-image-size-from-mb-to-kb/', isExternal: true },
      { icon: '📦', title: 'Compress under 1MB',    desc: 'For WhatsApp, email, and web uploads.',            href: '/compress-image-under-1mb/', isExternal: true },
    ],
  },
  {
    id: 'format',
    label: '🔄 Format & Convert',
    desc: 'Change formats, convert WebP, compress without losing quality.',
    tools: [
      { icon: '📷', title: 'Compress JPEG',         desc: 'Full quality control for JPG files.',              href: '/compress-jpg-online/', isExternal: true },
      { icon: '🖼️', title: 'Compress PNG',          desc: 'Shrink PNG size, keep transparency.',              href: '/compress-png-online/', isExternal: true },
      { icon: '🌐', title: 'WebP to JPG',            desc: 'Convert Chrome-saved WebP to JPEG.',              href: '/convert-webp-to-jpg/', isExternal: true },
      { icon: '✨', title: 'No quality loss',        desc: '85% JPEG — visually lossless results.',           href: '/image-compressor-without-losing-quality/', isExternal: true },
      { icon: '🔒', title: 'TinyPNG Alternative',   desc: 'No uploads. No limit. Fully private.',             href: '/tinypng-alternative/', isExternal: true },
    ],
  },
  {
    id: 'exam',
    label: '🏛️ Government Exam Photos',
    desc: 'Pre-configured size and dimension presets for every Indian exam portal.',
    tools: [
      { icon: '📜', title: 'UPSC Photo',            desc: '350×350px, under 200KB, OTR portal.',              href: '/compress-photo-for-upsc/', isExternal: true, badge: 'Exam' },
      { icon: '📋', title: 'SSC Photo',             desc: '200×230px, under 20KB, SSC One portal.',           href: '/compress-photo-for-ssc/', isExternal: true, badge: 'Exam' },
      { icon: '🛂', title: 'Passport Seva',         desc: '630×810px, under 250KB, white background.',        href: '/compress-image-for-passport-seva/', isExternal: true },
      { icon: '🏦', title: 'IBPS / SBI Photo',      desc: '200×230px, under 200KB for banking exams.',        href: '/compress-photo-for-ibps/', isExternal: true },
      { icon: '🚂', title: 'Railway RRB',           desc: '200×230px for RRB NTPC and Group D.',              href: '/compress-photo-for-railway-rrb/', isExternal: true },
    ],
  },
  {
    id: 'social',
    label: '📱 Social Media',
    desc: 'Exact pixel dimensions for every major platform.',
    tools: [
      { icon: '📸', title: 'Instagram',             desc: '1080×1080 posts · 1080×1920 stories.',            href: '/resize-image-for-instagram/', isExternal: true },
      { icon: '▶️', title: 'YouTube Thumbnail',     desc: '1280×720px, 16:9, under 2MB.',                    href: '/resize-image-for-youtube-thumbnail/', isExternal: true },
      { icon: '💬', title: 'WhatsApp DP',            desc: '500×500px sharp profile photo.',                  href: '/resize-image-for-whatsapp-dp/', isExternal: true },
      { icon: '💼', title: 'LinkedIn',              desc: '400×400px profile · 1584×396 banner.',            href: '/resize-image-for-linkedin/', isExternal: true },
      { icon: '📘', title: 'Facebook Cover',        desc: '820×312px cover photo.',                           href: '/resize-image-for-facebook/', isExternal: true },
    ],
  },
  {
    id: 'pdf',
    label: '📄 PDF Tools',
    desc: 'Merge, split, compress, and convert PDFs entirely in your browser. No upload, no signup, no size limit.',
    tools: [
      { icon: '🔗', title: 'Merge PDFs',      desc: 'Combine multiple PDFs into one. Drag to reorder.',           href: '/pdf-merge/',     badge: 'New' },
      { icon: '✂️', title: 'Split PDF',       desc: 'Extract pages or split into individual PDFs.',               href: '/pdf-split/',     badge: 'New' },
      { icon: '🗜️', title: 'Compress PDF',    desc: 'Reduce PDF file size by removing metadata and optimising.',  href: '/pdf-compress/',  badge: 'New' },
      { icon: '🖼️', title: 'PDF to Images',  desc: 'Convert each page to PNG or JPG. Download as ZIP.',         href: '/pdf-to-images/', badge: 'New' },
      { icon: '📄', title: 'Images to PDF',   desc: 'Convert JPG/PNG images into a single PDF document.',         href: '/images-to-pdf/', badge: 'New' },
    ],
  },
  {
    id: 'finance',
    label: '💰 Finance Calculators',
    desc: 'Free browser-based finance tools for loans, taxes, investments, and salary. No signup, no data sent anywhere.',
    tools: [
      { icon: '📊', title: 'EMI Calculator',    desc: 'Home, car & personal loan EMI with full amortization schedule.',  href: '/emi-calculator/',    badge: 'New' },
      { icon: '🧾', title: 'GST Calculator',    desc: 'Add/remove GST with CGST, SGST, IGST breakdown.',                href: '/gst-calculator/',    badge: 'New' },
      { icon: '📈', title: 'SIP Calculator',    desc: 'Monthly SIP or lump sum returns with year-by-year table.',       href: '/sip-calculator/',    badge: 'New' },
      { icon: '💼', title: 'Salary Calculator', desc: 'CTC to in-hand breakup with new & old tax regime.',              href: '/salary-calculator/', badge: 'New' },
      { icon: '⬛', title: 'QR Code Generator', desc: 'Custom QR codes with logo and color — coming next.',             href: '#',                   badge: 'Soon' },
    ],
  },
]

const FAQ = [
  { q: 'Do my files get uploaded to a server?', a: 'No. All compression, resizing, and conversion runs entirely in your browser using the HTML5 Canvas API. Your images never leave your device — no server, no cloud, no logs.' },
  { q: 'How does the exact KB target work?', a: 'We use a binary-search algorithm that compresses your image repeatedly at different quality levels until the output lands just under your target. Unlike tools where you guess a quality slider, ours hits the number automatically.' },
  { q: 'Which formats are supported?', a: 'Input: JPEG, PNG, WebP, BMP. Output: JPEG, PNG, or WebP. You can also convert formats in the same step — e.g. compress a WebP and save it as a JPG.' },
  { q: 'Is there a file size or daily usage limit?', a: 'No limits at all. Files of any size, as many times as you want, every day. Completely free, forever. We earn from non-intrusive ads.' },
  { q: 'Why is this better than TinyPNG?', a: 'TinyPNG uploads your file to their servers. We process everything locally in your browser, so nothing is ever sent anywhere. You also get exact KB targeting, which TinyPNG doesn\'t offer.' },
]

// ─── Page ────────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <div className="home">

      {/* ── HERO ── */}
      <section className="home-hero">
        <div className="hero-inner">
          <div className="hero-text">
            <div className="hero-tag">Free · No signup · 100% browser</div>
            <h1 className="hero-h1">
              We make<br />
              <span className="hero-accent">files easy.</span>
            </h1>
            <p className="hero-sub">
              Compress images &amp; PDFs to exact size targets — for government exams, email,
              WhatsApp, and more. Free, instant, nothing uploaded.
            </p>
            <div className="hero-ctas">
              <Link to="/image-compressor/" className="btn-primary">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="4" width="16" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M6 14l3-4 2.5 3 2-2.5L17 14H2" fill="currentColor" opacity=".7"/>
                  <circle cx="13" cy="8" r="1.5" fill="currentColor"/>
                </svg>
                Compress Image
              </Link>
              <Link to="/pdf-compress/" className="btn-primary btn-primary--pdf">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <rect x="4" y="2" width="10" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M14 2v5h5" fill="none" stroke="currentColor" strokeWidth="1.6"/>
                  <path d="M14 2l5 5" stroke="currentColor" strokeWidth="1.6"/>
                  <path d="M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Compress PDF
              </Link>
            </div>
            <div className="hero-stats">
              <div className="hero-stat"><strong>33+</strong><span>Free tools</span></div>
              <div className="hero-stat-sep" />
              <div className="hero-stat"><strong>100%</strong><span>Browser-based</span></div>
              <div className="hero-stat-sep" />
              <div className="hero-stat"><strong>0</strong><span>Files uploaded</span></div>
              <div className="hero-stat-sep" />
              <div className="hero-stat"><strong>∞</strong><span>Daily limit</span></div>
            </div>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* ── FEATURE STRIP ── */}
      <div className="feature-strip">
        <div className="feature-strip-inner">
          {[
            { icon: '🔒', title: 'Fully Private', desc: 'Files never leave your browser' },
            { icon: '⚡', title: 'Instant',        desc: 'No uploads — runs locally' },
            { icon: '🎯', title: 'Exact Targets',  desc: 'Binary-search hits your KB number' },
            { icon: '🆓', title: 'Free Forever',   desc: 'No limits, no watermarks, no signup' },
          ].map((f, i, arr) => (
            <span key={f.title}>
              <div className="feature-item">
                <span className="feature-icon">{f.icon}</span>
                <div>
                  <div className="feature-title">{f.title}</div>
                  <div className="feature-desc">{f.desc}</div>
                </div>
              </div>
              {i < arr.length - 1 && <div className="feature-sep" />}
            </span>
          ))}
        </div>
      </div>

      <AdSlot zone="top" />

      {/* ── ALL TOOLS ── */}
      <section className="tools-section" id="tools">
        <div className="tools-container">
          <div className="tools-header">
            <h2 className="tools-title">All Tools</h2>
            <p className="tools-sub">
              Image compression, format conversion, exam photo presets, social media resizing — and more coming soon.
            </p>
          </div>

          {TOOL_CATEGORIES.map((cat) => (
            <div key={cat.id} className="cat-block">
              <div className="cat-header">
                <h3 className="cat-title">{cat.label}</h3>
                <p className="cat-desc">{cat.desc}</p>
              </div>
              <div className="tool-grid">
                {cat.tools.map((t) => (
                  <ToolCard key={t.href + t.title} {...t} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <AdSlot zone="mid" />

      {/* ── HOW IT WORKS ── */}
      <section className="how-section">
        <div className="how-container">
          <h2 className="how-title">How it works</h2>
          <p className="how-sub">Three steps. Under 10 seconds.</p>
          <div className="how-grid">
            {[
              { n: '1', t: 'Drop your file', d: 'Drag & drop or click to select. Images (JPEG, PNG, WebP, BMP) or PDFs — any size. No account needed.' },
              { n: '2', t: 'Set your target',   d: 'Enter a KB/MB limit, pick dimensions, or choose a preset for your exam, platform, or use case.' },
              { n: '3', t: 'Download instantly', d: 'Compression runs in your browser in under a second. Your file never leaves your device.' },
            ].map((s) => (
              <div key={s.n} className="how-card">
                <div className="how-num">{s.n}</div>
                <h3 className="how-card-title">{s.t}</h3>
                <p className="how-card-desc">{s.d}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '32px' }}>
            <Link to="/image-compressor/" className="btn-primary">Try it free — no signup</Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="faq-section">
        <div className="faq-container">
          <h2 className="faq-title">Common questions</h2>
          <div className="faq-list">
            {FAQ.map((item) => (
              <details key={item.q} className="faq-item">
                <summary className="faq-q">{item.q}</summary>
                <p className="faq-a">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="cta-section">
        <div className="cta-inner">
          <h2 className="cta-title">Start compressing — it&apos;s free</h2>
          <p className="cta-sub">Images, PDFs, instant results. No account. No upload. No limits.</p>
          <div className="cta-btns">
            <Link to="/image-compressor/" className="btn-primary btn-primary--lg">
              Open Image Compressor
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <Link to="/pdf-compress/" className="btn-primary btn-primary--lg btn-primary--pdf">
              Open PDF Compressor
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <AdSlot zone="footer" />
      <AdSlot zone="sticky-mobile" />
    </div>
  )
}
