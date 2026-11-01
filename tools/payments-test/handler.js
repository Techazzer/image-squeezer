import { CheckoutError, sessionCookie, configured, configurationIssues, requireConfigured, signClaim, readClaim, hmac, cookies, cookie, grantCookie, requireSession, requireSameOrigin, readBody, productFor, verifyCheckoutSignature, validateOrder as validateCanonicalOrder, validatePayment } from './core.js'

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

export function createHandler({ products, publicPaths, mode = 'test', fetcher = fetch, clock = () => Math.floor(Date.now() / 1000) }) {
  if (!['test', 'live'].includes(mode)) throw Error('Unsupported payment mode')
  const validateOrder = (order, claim, product) => validateCanonicalOrder(order, claim, product, mode)
  const accessSeconds = mode === 'live' ? 31536000 : 86400
  const sessionSeconds = mode === 'live' ? 31536000 : 604800
  const receiptFor = async (env, claim) => mode === 'live' ? { accessLink: `/banana-leaf/#access=${await signClaim(env.ACCESS_TOKEN_SECRET, { ...claim, kind: 'receipt' })}` } : {}
  async function api(env, route, body) {
    // The host and all route components are fixed or validated; credentials never reach the browser.
    let response
    try {
      response = await fetcher(`https://api.razorpay.com/v1/${route}`, {
        method: body ? 'POST' : 'GET', redirect: 'manual', signal: AbortSignal.timeout(12000),
        headers: { Authorization: `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {})
      })
    } catch { throw new CheckoutError('payment_provider_unavailable', 502) }
    if (!response.ok) {
      // Razorpay can return authentication failures as HTTP 400. Never forward provider error text.
      const detail = await response.json().catch(() => ({}))
      const authenticationFailed = response.status === 401 || /authentication failed|invalid api key|invalid key secret/i.test(detail.error?.description || '')
      throw new CheckoutError(authenticationFailed ? 'credentials_invalid' : response.status < 500 ? 'payment_provider_rejected_request' : 'payment_provider_unavailable', 502)
    }
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
  const downloadable = product => product.files.map((file, index) => ({ label: file.label, format: file.format, href: `/banana-leaf/download/${product.id}/${index}` }))
  async function unlock(env, claim, product, payment) {
    const grant = { kind: 'grant', sid: claim.sid, productId: product.id, orderId: claim.orderId, paymentId: payment.id, exp: clock() + accessSeconds }
    const token = await signClaim(env.ACCESS_TOKEN_SECRET, grant)
    return json({ verified: true, mode, productId: product.id, paymentId: payment.id, files: downloadable(product), ...await receiptFor(env, grant) }, 200, { 'Set-Cookie': cookie(grantCookie(product.id, mode), token, accessSeconds) })
  }
  async function handle(request, env) {
    const url = new URL(request.url)
    // Keep payment endpoints inside the storefront's route on the shared Aeroniqx domain.
    const route = /^\/banana-leaf\/(?:api|download)\//.test(url.pathname) ? url.pathname.slice('/banana-leaf'.length) : url.pathname
    if ((route.startsWith('/api/') || route.startsWith('/download/')) && !url.pathname.startsWith('/banana-leaf/')) throw new CheckoutError('not_found', 404)
    if (request.method === 'GET' && route === '/api/config') {
      const ready = configured(env, mode)
      if (!ready) return json({ mode, ready: false, message: mode === 'live' ? 'Checkout is being activated. Please check again shortly.' : `Check these Cloudflare fields: ${configurationIssues(env, mode).join(', ')}. Test checkout is not active yet.` })
      let session
      try { session = await requireSession(request, env, clock()) }
      catch { session = { kind: 'session', sid: crypto.randomUUID(), exp: clock() + sessionSeconds } }
      return json({ mode, ready: true, keyId: env.RAZORPAY_KEY_ID, seller: 'Sarvaa Technologies', products: products.map(({ id, title, amount }) => ({ id, title, amount, currency: 'INR' })) }, 200,
        { 'Set-Cookie': cookie(sessionCookie(mode), await signClaim(env.ACCESS_TOKEN_SECRET, session), Math.max(1, session.exp - clock())) })
    }
    if (route.startsWith('/api/')) {
      requireConfigured(env, mode)
      const session = await requireSession(request, env, clock())
      if (request.method === 'GET' && route === '/api/access') {
        const grants = []
        for (const product of products) {
          try {
            const claim = await readClaim(env.ACCESS_TOKEN_SECRET, cookies(request)[grantCookie(product.id, mode)], 'grant', clock())
            if (claim.sid === session.sid && claim.productId === product.id) grants.push({ productId: product.id, paymentId: claim.paymentId, files: downloadable(product), ...await receiptFor(env, claim) })
          } catch { /* Expired access is not a purchase failure. */ }
        }
        return json({ grants })
      }
      if (request.method !== 'POST' || !['/api/orders', '/api/verify', '/api/recover', ...(mode === 'live' ? ['/api/restore'] : [])].includes(route)) throw new CheckoutError('not_found', 404)
      requireSameOrigin(request)
      const limitKey = [...await hmac(env.ACCESS_TOKEN_SECRET, `rate:${request.headers.get('CF-Connecting-IP') || session.sid}`)].map(byte => byte.toString(16).padStart(2, '0')).join('')
      if (!(await env.PAYMENT_LIMITER.limit({ key: limitKey })).success) throw new CheckoutError('rate_limited', 429)
      const body = await readBody(request)
      if (route === '/api/restore') {
        const receipt = await readClaim(env.ACCESS_TOKEN_SECRET, body.receipt, 'receipt', clock())
        if (!/^order_[A-Za-z0-9]+$/.test(receipt.orderId || '')) throw new CheckoutError('invalid_access', 403)
        const product = productFor(products, receipt.productId)
        const payment = await confirmedPayment(env, receipt, product, receipt.paymentId, false)
        return unlock(env, { ...receipt, sid: session.sid }, product, payment)
      }
      if (route === '/api/orders') {
        const product = productFor(products, body.productId)
        // Re-opening a checkout uses its existing authenticated order, rather than creating another one.
        if (body.orderClaim) {
          const claim = await validateClaim(env, body.orderClaim, session)
          if (claim.productId !== product.id) throw new CheckoutError('order_mismatch', 403)
          const order = await api(env, `orders/${claim.orderId}`); validateOrder(order, claim, product)
          return json({ orderId: order.id, orderClaim: body.orderClaim, productId: product.id, amount: product.amount, currency: 'INR', paid: order.status === 'paid' })
        }
        const order = await api(env, 'orders', { amount: product.amount, currency: 'INR', receipt: `${mode}_${crypto.randomUUID().replaceAll('-', '')}`, partial_payment: false, notes: { product_id: product.id, environment: `aeroniqx-${mode}-v1` } })
        if (!/^order_[A-Za-z0-9]+$/.test(order.id || '')) throw new CheckoutError('payment_provider_unavailable', 502)
        const claim = { kind: 'order', sid: session.sid, productId: product.id, orderId: order.id, exp: clock() + (mode === 'live' ? 604800 : 86400) }
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
      requireConfigured(env, mode)
      if (request.method !== 'GET') throw new CheckoutError('method_not_allowed', 405)
      const match = /^\/download\/([a-z0-9-]+)\/([0-9])$/.exec(route)
      if (!match) throw new CheckoutError('not_found', 404)
      const product = productFor(products, match[1]), file = product.files[Number(match[2])]
      if (!file) throw new CheckoutError('not_found', 404)
      const session = await requireSession(request, env, clock())
      const claim = await readClaim(env.ACCESS_TOKEN_SECRET, cookies(request)[grantCookie(product.id, mode)], 'grant', clock())
      if (claim.sid !== session.sid || claim.productId !== product.id || !/^order_[A-Za-z0-9]+$/.test(claim.orderId || '')) throw new CheckoutError('invalid_access', 403)
      await confirmedPayment(env, claim, product, claim.paymentId, false)
      const asset = await env.ASSETS.fetch(new Request(new URL(`/_private/${file.file}`, url.origin)))
      if (!asset.ok || asset.status !== 200) throw new CheckoutError('file_unavailable', 503)
      return new Response(asset.body, { headers: { 'Content-Type': file.file.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${file.file}"` } })
    }
    if (request.method === 'GET' && (route === '/' || route === '/banana-leaf')) return Response.redirect(`${url.origin}/banana-leaf/${url.search}`, 302)
    if (request.method === 'GET' && products.some(product => route === `/banana-leaf/${product.id}/` || route === `/banana-leaf/${product.id}`)) return Response.redirect(`${url.origin}/banana-leaf/#resources`, 302)
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
