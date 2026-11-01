# Razorpay test checkout

This is a separate Cloudflare Worker, `aeroniqx-payments-test`. It does not change the free production storefront. Only `rzp_test_` keys and `PAYMENT_MODE=test` are accepted. Live payments require a separate implementation/release decision, not changing a flag here.

## Build and deploy

From the site root:

```powershell
npm run build
node scripts/build-payment-test.mjs
node --test src/test/payments-test.test.js
..\cloudflare.cmd deploy --config tools/payments-test/wrangler.jsonc
```

Static assets run behind the Worker (`run_worker_first: true`). Only the explicit public-path manifest can be served directly. The actual PDF and Excel files live in `_private/` and are streamed only by the authenticated download route. Do not switch to asset-first routing or add a catch-all `ASSETS.fetch` fallback.

## Secure configuration

Cloudflare dashboard → Workers & Pages → **aeroniqx-payments-test** → Settings → Variables and Secrets → Add:

- `RAZORPAY_KEY_ID`: the Test Mode key ID (`rzp_test_…`), Text or Secret.
- `RAZORPAY_KEY_SECRET`: the matching test secret, **Secret** type.
- `ACCESS_TOKEN_SECRET`: separate random signing key, **Secret** type; initialized with `node scripts/init-payment-test-secret.mjs`. Existing values are preserved.

Only the account owner should generate Razorpay credentials and paste the key secret directly into Cloudflare. Never put it in chat, source files, frontend code, command arguments or commits. Save/deploy the configuration, then use **Check setup again** on the test page. The public configuration endpoint reveals only a readiness flag, the test key ID and product prices.

## Behavior and test cases

- Server-controlled amounts: supplier directory `9900` paise and registration guide `4900` paise, INR.
- Razorpay Orders API creates the order; browser retries reuse the signed order reference.
- An HttpOnly, Secure, host-only session cookie binds each order and download grant to the same browser.
- Checkout signatures are checked against the original server-signed order ID. Canonical order/payment data must match product, amount, INR currency and test deployment notes.
- Only captured, unrefunded payments unlock files. Authorized test payments can be captured for their exact expected amount. Download requests recheck the payment and revoke delivery after refund.
- Lost callbacks and refreshes recover by querying Razorpay using the browser-bound order reference. The page stores that reference in session storage, not card data.
- Downloads expire after 24 hours. Test orders are recorded in Razorpay; this test service has no separate customer database, outbound email, or webhook requirement. There is no cross-device purchase recovery in this test release.
- Rate limiting bounds checkout requests per hashed network address at each Cloudflare location. The binding is not a global exact quota.
- No real customer/payment information should be used in the sandbox. Simulate success, failure/cancel, refresh recovery and both product downloads using Razorpay's documented test methods.

The same resources were previously distributed publicly. Protecting the test endpoint does not make existing free downloads or copies private. A future paid launch needs its own access/recovery and public-copy migration plan, and an updated privacy notice reflecting the actual checkout.

Source documentation: [Razorpay Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [Worker-first assets](https://developers.cloudflare.com/workers/static-assets/binding/).
