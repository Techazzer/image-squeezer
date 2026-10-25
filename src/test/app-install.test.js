import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../../tools/app-shell/app.js', import.meta.url), 'utf8')
// Run the shipped controller against the browser signals that differ by platform.
function app({ standalone = false, ios = false, path = '/' } = {}) {
  class Element {
    hidden = false; disabled = true; open = false; dataset = {}; style = {}; attrs = new Map(); events = new Map()
    addEventListener(type, fn) { this.events.set(type, fn) }
    setAttribute(key, value) { this.attrs.set(key, value) }
    removeAttribute(key) { this.attrs.delete(key) }
    querySelector() { return new Element() }
    querySelectorAll() { return [] }
    close() { this.open = false; this.events.get('close')?.() }
    focus() { this.focused = true }
  }
  const elements = new Map(), events = new Map()
  const get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id) }
  const mode = { matches: standalone, addEventListener: (type, fn) => { mode.onChange = fn } }
  const window = { addEventListener: (type, fn) => events.set(type, fn) }
  const document = { documentElement: { style: {}, dataset: {} }, title: 'Bill Splitter', getElementById: id => id === 'root' ? null : get(id), querySelector: () => ({ textContent: 'Bill Splitter' }), querySelectorAll: () => [] }
  vm.runInNewContext(source, { window, document, location: { pathname: path, search: '' }, navigator: { standalone: ios, onLine: true }, matchMedia: () => mode, localStorage: { getItem: () => null }, URLSearchParams, setTimeout: () => 1, clearTimeout: () => {}, fetch: () => new Promise(() => {}) })
  return { get, fire: (type, event) => events.get(type)?.(event), displayMode: value => { mode.matches = value; mode.onChange() } }
}
function assertNavigation(a, installed) {
  assert.equal(a.get('aero-nav-install').hidden, installed)
  assert.equal(a.get('aero-nav-splitter').hidden, !installed)
  assert.equal(a.get('aero-nav-install').disabled, false)
}
test('ordinary browser visitors retain Get app rather than a fifth navigation item', () => {
  const a = app()
  assertNavigation(a, false)
  let prevented = false
  a.fire('beforeinstallprompt', { preventDefault() { prevented = true } })
  assert.ok(prevented)
  assert.equal(a.get('aero-install-now').hidden, false)
})
test('standalone and iOS home-screen launches show Bill Splitter and mark its route', () => {
  for (const options of [{ standalone: true }, { ios: true }]) {
    const a = app({ ...options, path: '/bill-splitter/' })
    assertNavigation(a, true)
    assert.equal(a.get('aero-nav-splitter').attrs.get('aria-current'), 'page')
    assert.equal(a.get('aero-nav-home').attrs.has('aria-current'), false)
    assert.equal(a.get('aero-install-now').hidden, true)
  }
})
test('display-mode changes update navigation in the same document', () => {
  const a = app()
  a.displayMode(true); assertNavigation(a, true)
  a.displayMode(false); assertNavigation(a, false)
})
test('successful installation switches immediately and closes installation help with visible focus', () => {
  const a = app()
  a.get('aero-install').open = true
  a.fire('appinstalled')
  assertNavigation(a, true)
  assert.equal(a.get('aero-install').open, false)
  assert.equal(a.get('aero-nav-splitter').focused, true)
  a.fire('pageshow'); assertNavigation(a, true)
  a.fire('beforeinstallprompt', { preventDefault() {} })
  assert.equal(a.get('aero-install-now').hidden, true)
})
