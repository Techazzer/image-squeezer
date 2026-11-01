const encoder = new TextEncoder()
const decoder = new TextDecoder()
export const SESSION_COOKIE = '__Host-aero-test-session'
export const sessionCookie = (mode = 'test') => `__Host-aero-${mode}-session`
export const grantCookie = (productId, mode = 'test') => `__Host-aero-${mode}-${productId}`
export class CheckoutError extends Error {
  constructor(code, status = 400) { super(code); this.status = status }
}
export function configured(env, mode = 'test') {
  return configurationIssues(env, mode).length === 0
}
export function configurationIssues(env, mode = 'test') {
  return [
    ['PAYMENT_MODE', ['test', 'live'].includes(mode) && env.PAYMENT_MODE === mode],
    ['RAZORPAY_KEY_ID', new RegExp(`^rzp_${mode}_[A-Za-z0-9]+$`).test(env.RAZORPAY_KEY_ID || '')],
    ['RAZORPAY_KEY_SECRET', typeof env.RAZORPAY_KEY_SECRET === 'string' && env.RAZORPAY_KEY_SECRET.length >= 16],
    ['ACCESS_TOKEN_SECRET', typeof env.ACCESS_TOKEN_SECRET === 'string' && env.ACCESS_TOKEN_SECRET.length >= 32],
    ['PAYMENT_LIMITER', !!env.PAYMENT_LIMITER]
  ].filter(([, valid]) => !valid).map(([name]) => name)
}
export function requireConfigured(env, mode = 'test') {
  if (!configured(env, mode)) throw new CheckoutError('setup_required', 503)
}
const base64url = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
function unbase64url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 4096) throw new CheckoutError('invalid_access', 403)
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0))
}
async function key(secret) { return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']) }
export async function hmac(secret, value) { return new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(value))) }
export async function signClaim(secret, payload) {
  const body = base64url(encoder.encode(JSON.stringify(payload)))
  return `${body}.${base64url(await hmac(secret, `aeroniqx-test-v1.${body}`))}`
}
export async function readClaim(secret, token, kind, now) {
  try {
    const parts = String(token || '').split('.')
    const [body, signature] = parts
    if (parts.length !== 2 || !body || !signature || !await crypto.subtle.verify('HMAC', await key(secret), unbase64url(signature), encoder.encode(`aeroniqx-test-v1.${body}`))) throw Error()
    const claim = JSON.parse(decoder.decode(unbase64url(body)))
    if (claim.kind !== kind || !Number.isSafeInteger(claim.exp) || claim.exp <= now || !/^[a-f0-9-]{36}$/.test(claim.sid || '')) throw Error()
    return claim
  } catch { throw new CheckoutError('invalid_access', 403) }
}
export function cookies(request) {
  return Object.fromEntries((request.headers.get('Cookie') || '').split(';').map(pair => {
    const i = pair.indexOf('='); return [pair.slice(0, i).trim(), pair.slice(i + 1)]
  }).filter(([name]) => name))
}
export const cookie = (name, value, seconds = 86400) => `${name}=${value}; Path=/; Max-Age=${seconds}; Secure; HttpOnly; SameSite=Lax`
export async function requireSession(request, env, now) {
  return readClaim(env.ACCESS_TOKEN_SECRET, cookies(request)[sessionCookie(env.PAYMENT_MODE)], 'session', now)
}
export async function readBody(request) {
  if (!/^application\/json\b/i.test(request.headers.get('Content-Type') || '')) throw new CheckoutError('json_required', 415)
  if (Number(request.headers.get('Content-Length')) > 4096) throw new CheckoutError('payload_too_large', 413)
  const reader = request.body?.getReader(); if (!reader) throw new CheckoutError('invalid_request')
  const chunks = []; let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      size += value.length; if (size > 4096) throw new CheckoutError('payload_too_large', 413)
      chunks.push(value)
    }
  } finally { await reader.cancel().catch(() => {}) }
  try {
    const bytes = new Uint8Array(size); let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    const value = JSON.parse(decoder.decode(bytes))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error()
    return value
  } catch { throw new CheckoutError('invalid_request') }
}
export function requireSameOrigin(request) {
  if (request.headers.get('Origin') !== new URL(request.url).origin) throw new CheckoutError('origin_not_allowed', 403)
}
export function productFor(products, id) {
  const product = products.find(item => item.id === id)
  if (!product) throw new CheckoutError('unknown_product', 404)
  return product
}
export async function verifyCheckoutSignature(secret, orderId, paymentId, signature) {
  if (!/^[a-f0-9]{64}$/i.test(signature || '')) throw new CheckoutError('invalid_signature', 403)
  const bytes = Uint8Array.from(signature.match(/../g), value => parseInt(value, 16))
  if (!await crypto.subtle.verify('HMAC', await key(secret), bytes, encoder.encode(`${orderId}|${paymentId}`))) throw new CheckoutError('invalid_signature', 403)
}
export function validateOrder(order, claim, product, mode = 'test') {
  if (order.id !== claim.orderId || order.amount !== product.amount || order.currency !== 'INR' ||
      order.notes?.product_id !== product.id || order.notes?.environment !== `aeroniqx-${mode}-v1`) throw new CheckoutError('order_mismatch', 403)
}
export function validatePayment(payment, claim, product, captured = true) {
  if (payment.order_id !== claim.orderId || payment.amount !== product.amount || payment.currency !== 'INR' ||
      !/^pay_[A-Za-z0-9]+$/.test(payment.id || '')) throw new CheckoutError('payment_mismatch', 403)
  if (payment.amount_refunded !== 0 || payment.refund_status || payment.disputed === true) throw new CheckoutError('payment_not_eligible', 403)
  if (captured && (payment.status !== 'captured' || payment.captured !== true)) throw new CheckoutError('payment_pending', 409)
}
