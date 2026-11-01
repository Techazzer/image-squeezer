import { CheckoutError, SESSION_COOKIE, configured, configurationIssues, requireConfigured, signClaim, readClaim, hmac, cookies, cookie, grantCookie, requireSession, requireSameOrigin, readBody, productFor, verifyCheckoutSignature, validateOrder, validatePayment } from './core.js'

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...extra } })
const safeResponse = response => {
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'private, no-store')
  headers.set('X-Robots-Tag', 'noindex, nofollow')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('Referrer-Policy', 'no-referrer')
  headers.set('Content-Security-Policy', "frame-ancestors 'none'; base-uri 'self'; object-src 'none'")
  return new Response(response.body, { status: response.status, headers })
}

export function createHandler({ products, publicPaths, fetcher = fetch, clock = () => Math.floor(Date.now() / 1000) }) {
  async function api(env, route, body) {
    // The host and all route components are fixed or validated; credentials never reach the browser.
    let response
    try {
      response = await fetcher(`https://api.razorpay.com/v1/${route}`, {
        method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(12000),
        headers: { Authorization: `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {})
      })
    } catch { throw new CheckoutError('payment_provider_unavailable', 502) }
    if (!response.ok) throw new CheckoutError(response.status === 401 ? 'credentials_invalid' : 'payment_provider_unavailable', 502)
    return response.json()
  }
  async function validateClaim(env, token, session) {
    const claim = await readClaim(env.ACCESS_TOKEN_SECRET, token, 'order', clock())
    if (claim.sid !== session.sid || !/^order_[A-Za-z0-9]+$/.test(claim.orderId || '')) throw new CheckoutError('invalid_access', 403)
    productFor(products, claim.productId)
    return claim
  }
  async function confirmedPayment(env, claim, product, paymentId, capture) {
    if (!/^pay_[A-Za-z0-9]+$/.test(paymentId || '')) throw new CheckoutError('invalid_payment')
    let [order, payment] = await Promise.all([api(env, `orders/${claim.orderId}`), api(env, `payments/${paymentId}`)])
    if (payment.id !== paymentId) throw new CheckoutError('payment_mismatch', 403)
    validateOrder(order, claim, product); validatePayment(payment, claim, product, false)
    if (capture && payment.status === 'authorized') {
      try { payment = await api(env, `payments/${paymentId}/capture`, { amount: product.amount, currency: 'INR' }) }
      catch { payment = await api(env, `payments/${paymentId}`) } // Automatic capture can win the race.
      order = await api(env, `orders/${claim.orderId}`)
      validateOrder(order, claim, product)
    }
    validatePayment(payment, claim, product)
    if (order.status !== 'paid' || order.amount_paid !== product.amount || order.amount_due !== 0) throw new CheckoutError('payment_pending', 409)
    return payment
  }
  const downloadable = product => product.files.map((file, index) => ({ label: file.label, format: file.format, href: `/download/${product.id}/${index}` }))
  async function unlock(env, claim, product, payment) {
    const token = await signClaim(env.ACCESS_TOKEN_SECRET, { kind: 'grant', sid: claim.sid, productId: product.id, orderId: claim.orderId, paymentId: payment.id, exp: clock() + 86400 })
    return json({ verified: true, mode: 'test', productId: product.id, files: downloadable(product) }, 200, { 'Set-Cookie': cookie(grantCookie(product.id), token) })
  }
  async function handle(request, env) {
    const url = new URL(request.url), route = url.pathname
    if (request.method === 'GET' && route === '/api/config') {
      const ready = configured(env)
      if (!ready) return json({ mode: 'test', ready: false, message: `Check these Cloudflare fields: ${configurationIssues(env).join(', ')}. Test checkout is not active yet.` })
      let session
      try { session = await requireSession(request, env, clock()) }
      catch { session = { kind: 'session', sid: crypto.randomUUID(), exp: clock() + 604800 } }
      return json({ mode: 'test', ready: true, keyId: env.RAZORPAY_KEY_ID, seller: 'Sarvaa Technologies', products: products.map(({ id, title, amount }) => ({ id, title, amount, currency: 'INR' })) }, 200,
        { 'Set-Cookie': cookie(SESSION_COOKIE, await signClaim(env.ACCESS_TOKEN_SECRET, session), Math.max(1, session.exp - clock())) })
    }
    if (route.startsWith('/api/')) {
      requireConfigured(env)
      const session = await requireSession(request, env, clock())
      if (request.method === 'GET' && route === '/api/access') {
        const grants = []
        for (const product of products) {
          try {
            const claim = await readClaim(env.ACCESS_TOKEN_SECRET, cookies(request)[grantCookie(product.id)], 'grant', clock())
            if (claim.sid === session.sid && claim.productId === product.id) grants.push({ productId: product.id, files: downloadable(product) })
          } catch { /* Expired access is not a purchase failure. */ }
        }
        return json({ grants })
      }
      if (request.method !== 'POST' || !['/api/orders', '/api/verify', '/api/recover'].includes(route)) throw new CheckoutError('not_found', 404)
      requireSameOrigin(request)
      const limitKey = [...await hmac(env.ACCESS_TOKEN_SECRET, `rate:${request.headers.get('CF-Connecting-IP') || session.sid}`)].map(byte => byte.toString(16).padStart(2, '0')).join('')
      if (!(await env.PAYMENT_LIMITER.limit({ key: limitKey })).success) throw new CheckoutError('rate_limited', 429)
      const body = await readBody(request)
      if (route === '/api/orders') {
        const product = productFor(products, body.productId)
        // Re-opening a checkout uses its existing authenticated order, rather than creating another one.
        if (body.orderClaim) {
          const claim = await validateClaim(env, body.orderClaim, session)
          if (claim.productId !== product.id) throw new CheckoutError('order_mismatch', 403)
          const order = await api(env, `orders/${claim.orderId}`); validateOrder(order, claim, product)
          return json({ orderId: order.id, orderClaim: body.orderClaim, productId: product.id, amount: product.amount, currency: 'INR', paid: order.status === 'paid' })
        }
        const order = await api(env, 'orders', { amount: product.amount, currency: 'INR', receipt: `test_${crypto.randomUUID().replaceAll('-', '')}`, partial_payment: false, notes: { product_id: product.id, environment: 'aeroniqx-test-v1' } })
        if (!/^order_[A-Za-z0-9]+$/.test(order.id || '')) throw new CheckoutError('payment_provider_unavailable', 502)
        const claim = { kind: 'order', sid: session.sid, productId: product.id, orderId: order.id, exp: clock() + 86400 }
        validateOrder(order, claim, product)
        return json({ orderId: order.id, orderClaim: await signClaim(env.ACCESS_TOKEN_SECRET, claim), productId: product.id, amount: product.amount, currency: 'INR', paid: false })
      }
      const claim = await validateClaim(env, body.orderClaim, session), product = productFor(products, claim.productId)
      if (route === '/api/verify') {
        if (body.razorpay_order_id !== claim.orderId) throw new CheckoutError('order_mismatch', 403)
        await verifyCheckoutSignature(env.RAZORPAY_KEY_SECRET, claim.orderId, body.razorpay_payment_id, body.razorpay_signature)
        return unlock(env, claim, product, await confirmedPayment(env, claim, product, body.razorpay_payment_id, true))
      }
      // Recovery consults Razorpay directly, so refreshes, lost callbacks and delayed capture are supported.
      const order = await api(env, `orders/${claim.orderId}`); validateOrder(order, claim, product)
      const payments = await api(env, `orders/${claim.orderId}/payments`)
      const payment = payments.items?.find(item => ['captured', 'authorized'].includes(item.status) && item.amount_refunded === 0)
      if (!payment) throw new CheckoutError('payment_pending', 409)
      return unlock(env, claim, product, await confirmedPayment(env, claim, product, payment.id, true))
    }
    if (route.startsWith('/download/')) {
      requireConfigured(env)
      if (request.method !== 'GET') throw new CheckoutError('method_not_allowed', 405)
      const match = /^\/download\/([a-z0-9-]+)\/([0-9])$/.exec(route)
      if (!match) throw new CheckoutError('not_found', 404)
      const product = productFor(products, match[1]), file = product.files[Number(match[2])]
      if (!file) throw new CheckoutError('not_found', 404)
      const session = await requireSession(request, env, clock())
      const claim = await readClaim(env.ACCESS_TOKEN_SECRET, cookies(request)[grantCookie(product.id)], 'grant', clock())
      if (claim.sid !== session.sid || claim.productId !== product.id || !/^order_[A-Za-z0-9]+$/.test(claim.orderId || '')) throw new CheckoutError('invalid_access', 403)
      await confirmedPayment(env, claim, product, claim.paymentId, false)
      const asset = await env.ASSETS.fetch(new Request(new URL(`/_private/${file.file}`, url.origin)))
      if (!asset.ok || asset.status !== 200) throw new CheckoutError('file_unavailable', 503)
      return new Response(asset.body, { headers: { 'Content-Type': file.file.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${file.file}"` } })
    }
    if (request.method === 'GET' && route === '/') return Response.redirect(`${url.origin}/banana-leaf/`, 302)
    if (['GET', 'HEAD'].includes(request.method) && publicPaths.includes(route)) return env.ASSETS.fetch(request)
    // There is no catch-all assets fallback: direct or encoded private-file URLs cannot bypass verification.
    throw new CheckoutError('not_found', 404)
  }
  return async (request, env) => {
    // Clipboard whitespace is not part of a Razorpay credential; never return its value in setup errors.
    env = { ...env, RAZORPAY_KEY_ID: typeof env.RAZORPAY_KEY_ID === 'string' ? env.RAZORPAY_KEY_ID.trim() : env.RAZORPAY_KEY_ID,
      RAZORPAY_KEY_SECRET: typeof env.RAZORPAY_KEY_SECRET === 'string' ? env.RAZORPAY_KEY_SECRET.trim() : env.RAZORPAY_KEY_SECRET }
    try { return safeResponse(await handle(request, env)) }
    catch (error) { return safeResponse(json({ error: error instanceof CheckoutError ? error.message : 'temporarily_unavailable' }, error instanceof CheckoutError ? error.status : 503)) }
  }
}
