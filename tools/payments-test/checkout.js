const buttons = [...document.querySelectorAll('[data-test-buy]')]
const status = document.getElementById('checkout-message')
const recoverButton = document.getElementById('recover-payment')
const downloadArea = document.getElementById('test-downloads')
const setupButton = document.getElementById('check-setup')
const pendingKey = 'aeroniqx-test-pending-v1'
let config, pending, activeCheckout, sdkPromise, busy = false
try { pending = JSON.parse(sessionStorage.getItem(pendingKey) || 'null') } catch { /* Storage can be blocked. */ }
function savePending(value) {
  pending = value
  try { value ? sessionStorage.setItem(pendingKey, JSON.stringify(value)) : sessionStorage.removeItem(pendingKey) } catch {}
  recoverButton.hidden = !value
}
function message(text, error = false) { status.textContent = text; status.classList.toggle('checkout-error', error) }
function setBusy(value) { busy = value; buttons.forEach(button => button.disabled = value || !config?.ready); recoverButton.disabled = value }
const errors = {
  setup_required: 'Test checkout is waiting for its secure API configuration.',
  credentials_invalid: 'The test API credentials need checking in Cloudflare.',
  invalid_access: 'This test session has expired. Refresh the page to start a new session.',
  payment_pending: 'Payment is not confirmed yet. If you completed the test payment, select Check payment status.',
  rate_limited: 'Please wait a minute before checking again.',
  payment_not_eligible: 'This payment is refunded or no longer eligible for access.',
  payment_provider_unavailable: 'Razorpay could not be reached. Try Check payment status before starting another payment.'
}
async function api(path, body) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) })
  const result = await response.json()
  if (!response.ok) { const error = new Error(errors[result.error] || 'We could not verify this request. Try again.'); error.code = result.error; throw error }
  return result
}
function showFiles(grant) {
  if (document.getElementById(`files-${grant.productId}`)) return
  const section = document.createElement('section'); section.id = `files-${grant.productId}`; section.className = 'checkout-files'
  const heading = document.createElement('h3'); heading.textContent = config.products.find(p => p.id === grant.productId)?.title || 'Your resource'
  const note = document.createElement('p'); note.textContent = 'Test payment verified. Your complete files are ready to download.'
  section.append(heading, note)
  for (const file of grant.files) {
    const link = document.createElement('a'); link.className = 'resource-button'; link.href = file.href; link.textContent = file.label
    section.append(link)
  }
  downloadArea.append(section); downloadArea.hidden = false
}
function sdk() {
  if (window.Razorpay) return Promise.resolve()
  if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.async = true
    script.onload = () => window.Razorpay ? resolve() : reject(new Error('Razorpay checkout did not load.'))
    script.onerror = () => { script.remove(); sdkPromise = null; reject(new Error('Razorpay checkout could not load. Check your connection and try again.')) }
    document.head.append(script)
  })
  return sdkPromise
}
async function verify(result) {
  setBusy(true); message('Confirming the test payment with Razorpay…')
  try {
    const grant = await api('/api/verify', { orderClaim: pending.orderClaim, ...result })
    showFiles(grant); savePending(null); message('Test payment confirmed. No real money was charged.'); downloadArea.scrollIntoView({ block: 'start', behavior: 'smooth' })
  } catch (error) { message(error.message, true); recoverButton.hidden = false }
  finally { setBusy(false) }
}
async function recover() {
  if (!pending || busy) return
  setBusy(true); message('Checking this order with Razorpay…')
  try {
    const grant = await api('/api/recover', { orderClaim: pending.orderClaim })
    showFiles(grant); savePending(null); message('Test payment confirmed. Your downloads are ready.')
  } catch (error) {
    message(error.message, true)
    if (error.code === 'invalid_access') savePending(null)
  } finally { setBusy(false) }
}
async function buy(productId) {
  if (busy || !config?.ready) return
  if (pending && pending.productId !== productId) {
    message('Finish or check the existing test order first. Use Start another test to switch resources.', true)
    document.getElementById('checkout-status').scrollIntoView({ block: 'start' }); return
  }
  setBusy(true); message('Opening Razorpay Test Mode…')
  try {
    await sdk()
    const order = await api('/api/orders', { productId, ...(pending ? { orderClaim: pending.orderClaim } : {}) })
    savePending(order)
    if (order.paid) { setBusy(false); await recover(); return }
    const product = config.products.find(item => item.id === productId)
    activeCheckout = new window.Razorpay({
      key: config.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency,
      name: config.seller, description: `${product.title} — TEST PAYMENT`,
      theme: { color: '#1557b0' }, handler: verify,
      modal: { ondismiss: () => { setBusy(false); message('Checkout closed. No downloads are unlocked until payment is confirmed. You can retry Buy Now or Check payment status.') } }
    })
    activeCheckout.on('payment.failed', () => { message('The test payment failed. Retry in Razorpay or close it and check the order status.', true) })
    activeCheckout.open()
  } catch (error) { message(error.message, true); setBusy(false) }
}
async function initialize() {
  setBusy(true)
  try {
    config = await api('/api/config')
    if (!config.ready) { message(config.message); setupButton.hidden = false; return }
    setupButton.hidden = true
    message('Test checkout is ready. Choose a resource to simulate a payment. No real money will be charged.')
    for (const grant of (await api('/api/access')).grants) showFiles(grant)
    if (pending) { recoverButton.hidden = false; message('An earlier test order is available. Check its payment status before retrying.') }
  } catch { message('The checkout could not connect. Please reload and try again.', true); setupButton.hidden = false }
  finally { setBusy(false) }
}
buttons.forEach(button => button.addEventListener('click', () => buy(button.dataset.testBuy)))
recoverButton.addEventListener('click', recover)
setupButton.addEventListener('click', initialize)
document.getElementById('reset-test').addEventListener('click', () => {
  if (busy) return
  savePending(null); message('Ready for another test. Any previously paid resource remains available in this browser until its test access expires.')
})
await initialize()
