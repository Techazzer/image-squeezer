import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHandler } from '../../tools/payments-test/handler.js'
import { hmac, readClaim, signClaim, SESSION_COOKIE, grantCookie } from '../../tools/payments-test/core.js'

const products = JSON.parse(await readFile(new URL('../../content/business-resources.json', import.meta.url), 'utf8')).products.map(p => ({ ...p, amount: p.listPricePaise }))
const origin = 'https://checkout.example.test'
function setup() {
  let now = 1800000000, serial = 0
  const orders = new Map(), payments = new Map(), calls = [], assetReads = []
  const env = { PAYMENT_MODE: 'test', RAZORPAY_KEY_ID: 'rzp_test_fixture', RAZORPAY_KEY_SECRET: 'test-secret-fixture-not-a-real-key', ACCESS_TOKEN_SECRET: 'signing-fixture-not-a-real-key-0123456789', PAYMENT_LIMITER: { limit: async () => ({ success: true }) },
    ASSETS: { fetch: async request => { assetReads.push(new URL(request.url).pathname); return new Response('%PDF-test-download', { headers: { 'Content-Type': 'application/pdf' } }) } } }
  const fetcher = async (url, init) => {
    const route = new URL(url).pathname.replace('/v1/', '')
    calls.push({ route, method: init.method, body: init.body ? JSON.parse(init.body) : undefined })
    let body
    if (route === 'orders' && init.method === 'POST') {
      body = { id: `order_fixture${++serial}`, ...JSON.parse(init.body), status: 'created', amount_paid: 0, amount_due: JSON.parse(init.body).amount }
      orders.set(body.id, body)
    } else if (/^orders\/[^/]+\/payments$/.test(route)) body = { items: [...payments.values()].filter(p => p.order_id === route.split('/')[1]) }
    else if (/^orders\/[^/]+$/.test(route)) body = orders.get(route.split('/')[1])
    else if (/^payments\/[^/]+\/capture$/.test(route)) {
      body = payments.get(route.split('/')[1]); const capture = JSON.parse(init.body)
      assert.deepEqual(capture, { amount: body.amount, currency: 'INR' })
      body.status = 'captured'; body.captured = true
      const order = orders.get(body.order_id); order.status = 'paid'; order.amount_paid = order.amount; order.amount_due = 0
    } else if (/^payments\/[^/]+$/.test(route)) body = payments.get(route.split('/')[1])
    return new Response(JSON.stringify(body || { error: 'not_found' }), { status: body ? 200 : 404, headers: { 'Content-Type': 'application/json' } })
  }
  const handle = createHandler({ products, publicPaths: ['/banana-leaf/'], fetcher, clock: () => now })
  function client() {
    const jar = {}
    return {
      jar,
      async request(path, body, extra = {}) {
        const request = new Request(origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin, Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
        const response = await handle(request, env)
        const set = response.headers.get('set-cookie')
        if (set) { const [name, ...value] = set.split(';')[0].split('='); jar[name] = value.join('=') }
        return response
      }
    }
  }
  const authorize = (order, status = 'authorized') => {
    const payment = { id: `pay_fixture${payments.size + 1}`, order_id: order.orderId, amount: orders.get(order.orderId).amount, currency: 'INR', status, captured: status === 'captured', amount_refunded: 0, refund_status: null }
    payments.set(payment.id, payment)
    if (status === 'captured') Object.assign(orders.get(order.orderId), { status: 'paid', amount_paid: payment.amount, amount_due: 0 })
    return payment
  }
  const signature = async (order, payment) => [...await hmac(env.RAZORPAY_KEY_SECRET, `${order.orderId}|${payment.id}`)].map(b => b.toString(16).padStart(2, '0')).join('')
  const verification = async (order, payment) => ({ orderClaim: order.orderClaim, razorpay_order_id: order.orderId, razorpay_payment_id: payment.id, razorpay_signature: await signature(order, payment) })
  return { env, handle, client, calls, orders, payments, assetReads, authorize, verification, advance: seconds => { now += seconds }, time: () => now }
}
const begin = async (s, c, productId = products[0].id, extra = {}) => {
  await c.request('/api/config')
  const response = await c.request('/api/orders', { productId, ...extra }); assert.equal(response.status, 200)
  return response.json()
}

test('test checkout fixes both INR prices server-side and never exposes a secret', async () => {
  const s = setup(), c = s.client()
  const config = await c.request('/api/config'), publicConfig = await config.text()
  assert.match(config.headers.get('set-cookie'), /Secure; HttpOnly; SameSite=Lax/)
  assert.ok(!publicConfig.includes(s.env.RAZORPAY_KEY_SECRET)); assert.ok(!publicConfig.includes(s.env.ACCESS_TOKEN_SECRET))
  for (const product of products) {
    const order = await begin(s, c, product.id, { amount: 1, currency: 'USD', pricePaise: 0 })
    assert.equal(order.amount, product.amount); assert.equal(order.currency, 'INR')
    assert.equal(s.orders.get(order.orderId).amount, product.amount)
  }
})
test('missing secrets, a live key, or a live mode cannot create an order', async () => {
  for (const change of [env => delete env.RAZORPAY_KEY_SECRET, env => env.RAZORPAY_KEY_ID = 'rzp_live_wrong', env => env.PAYMENT_MODE = 'live', env => delete env.ACCESS_TOKEN_SECRET]) {
    const s = setup(); change(s.env); const c = s.client()
    assert.equal((await (await c.request('/api/config')).json()).ready, false)
    assert.equal((await c.request('/api/orders', { productId: products[0].id })).status, 503)
    assert.equal(s.calls.length, 0)
  }
})
test('captured and signed test payments unlock only their own full files', async () => {
  for (const product of products) {
    const s = setup(), c = s.client(), order = await begin(s, c, product.id), payment = s.authorize(order)
    assert.equal((await c.request(`/download/${product.id}/0`)).status, 403)
    const result = await c.request('/api/verify', await s.verification(order, payment)); assert.equal(result.status, 200)
    assert.equal((await result.json()).files.length, product.files.length)
    const file = await c.request(`/download/${product.id}/0`)
    assert.equal(file.status, 200); assert.match(file.headers.get('content-disposition'), /attachment/); assert.match(file.headers.get('cache-control'), /no-store/)
    assert.equal(await file.text(), '%PDF-test-download')
    assert.equal((await c.request(`/download/${products.find(p => p.id !== product.id).id}/0`)).status, 403)
  }
})
test('wrong signature, altered product, wrong session and foreign order fail closed', async () => {
  const s = setup(), a = s.client(), b = s.client(), order = await begin(s, a), payment = s.authorize(order)
  await b.request('/api/config')
  const valid = await s.verification(order, payment)
  assert.equal((await a.request('/api/verify', { ...valid, razorpay_signature: '0'.repeat(64) })).status, 403)
  assert.equal((await a.request('/api/verify', { ...valid, razorpay_order_id: 'order_foreign' })).status, 403)
  assert.equal((await b.request('/api/verify', valid)).status, 403)
  assert.equal((await a.request('/api/orders', { productId: products[1].id, orderClaim: order.orderClaim })).status, 403)
  assert.equal((await a.request('/api/verify', { ...valid, orderClaim: order.orderClaim.slice(0, -3) + 'aaa' })).status, 403)
  assert.equal(s.calls.filter(c => c.route.endsWith('/capture')).length, 0)
})
test('payment amount, currency, product metadata and capture status must match', async () => {
  for (const mutate of [(p, o) => p.amount = 1, (p, o) => p.currency = 'USD', (p, o) => p.order_id = 'order_foreign', (p, o) => o.notes.product_id = products[1].id, (p, o) => o.notes.environment = 'other', (p, o) => p.status = 'failed']) {
    const s = setup(), c = s.client(), order = await begin(s, c), payment = s.authorize(order)
    const verification = await s.verification(order, payment); mutate(payment, s.orders.get(order.orderId))
    assert.ok((await c.request('/api/verify', verification)).status >= 400)
    assert.equal((await c.request(`/download/${products[0].id}/0`)).status, 403)
  }
})
test('callback loss recovers from Razorpay and order retries reuse the original order', async () => {
  const s = setup(), c = s.client(), order = await begin(s, c)
  const again = await c.request('/api/orders', { productId: products[0].id, orderClaim: order.orderClaim })
  assert.equal((await again.json()).orderId, order.orderId); assert.equal(s.orders.size, 1)
  assert.equal((await c.request('/api/recover', { orderClaim: order.orderClaim })).status, 409)
  s.authorize(order, 'captured')
  assert.equal((await c.request('/api/recover', { orderClaim: order.orderClaim })).status, 200)
  assert.equal((await (await c.request('/api/access')).json()).grants.length, 1)
})
test('refunds and expired tokens revoke file delivery, including copied cookies in another session', async () => {
  const s = setup(), a = s.client(), b = s.client(), order = await begin(s, a), payment = s.authorize(order, 'captured')
  await a.request('/api/verify', await s.verification(order, payment)); await b.request('/api/config')
  b.jar[grantCookie(products[0].id)] = a.jar[grantCookie(products[0].id)]
  assert.equal((await b.request(`/download/${products[0].id}/0`)).status, 403)
  payment.amount_refunded = payment.amount
  assert.equal((await a.request(`/download/${products[0].id}/0`)).status, 403)
  payment.amount_refunded = 0; s.advance(86401)
  assert.equal((await a.request(`/download/${products[0].id}/0`)).status, 403)
  assert.equal((await a.request('/api/recover', { orderClaim: order.orderClaim })).status, 403)
})
test('private files, path tricks, cross-origin posts and oversized bodies cannot bypass checkout', async () => {
  const s = setup(), c = s.client(); await c.request('/api/config')
  for (const path of ['/_private/banana-leaf-supplier-pack.pdf', '/_private%2fbanana-leaf-supplier-pack.pdf', '/assets/../_private/banana-leaf-supplier-pack.pdf', '/download/banana-leaf-suppliers/9', '/manifest.generated.js']) assert.ok((await c.request(path)).status >= 400)
  assert.equal(s.assetReads.length, 0)
  assert.equal((await c.request('/api/orders', { productId: products[0].id }, { Origin: 'https://attacker.example' })).status, 403)
  assert.equal((await c.request('/api/orders', { productId: products[0].id, padding: 'x'.repeat(5000) })).status, 413)
  assert.equal((await c.request('/api/orders', { productId: 'not-a-product' })).status, 404)
  s.env.PAYMENT_LIMITER.limit = async () => ({ success: false })
  assert.equal((await c.request('/api/orders', { productId: products[0].id })).status, 429)
})
test('cryptographic claims reject changed payloads, invalid encoding and expired sessions', async () => {
  const s = setup(), sid = crypto.randomUUID(), token = await signClaim(s.env.ACCESS_TOKEN_SECRET, { kind: 'session', sid, exp: s.time() + 10 })
  assert.equal((await readClaim(s.env.ACCESS_TOKEN_SECRET, token, 'session', s.time())).sid, sid)
  for (const bad of ['', 'a.b.c', token + '.', token.replace(/^./, 'x')]) await assert.rejects(readClaim(s.env.ACCESS_TOKEN_SECRET, bad, 'session', s.time()))
  await assert.rejects(readClaim(s.env.ACCESS_TOKEN_SECRET, token, 'session', s.time() + 10))
  assert.match(SESSION_COOKIE, /^__Host-/)
})
