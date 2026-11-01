# Live banana-leaf checkout

Prices are fixed server-side: supplier directory ₹99; export-registration guide ₹49. The live Worker shares reviewed checkout code with the sandbox, but explicitly selects live mode and requires `rzp_live_` credentials, a separate signing secret, separate cookies, and `aeroniqx-live-v1` order metadata. Sandbox purchases never unlock live files.

## Build and deploy

`content/payment-release.json` enables the paid Pages release. `npm run build` builds the live Worker assets before replacing public storefront pages, removes the three free file copies from the current Pages deployment, updates the library/guide purchase links and publishes the live privacy/refund/terms pages. Run `npm test` and `node scripts/check-build.mjs` before deployment.

Deploy the Worker with `..\cloudflare.cmd deploy --config tools/payments-live/wrangler.jsonc`. Main-branch pushes deploy the related Pages changes via the existing workflow. Cloudflare routes `aeroniqx.in/banana-leaf` and `aeroniqx.in/banana-leaf/*` must both point to this Worker, with fail-closed routing. Also route `aeroniqx.in/downloads/business/*` here: the allowlist rejects these old public download URLs with 404 even if old Pages assets remain cached. Never return to free Pages as a failure fallback.

The owner enters `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` as encrypted Secrets directly in Cloudflare. The signing secret is initialized with `node scripts/init-payment-test-secret.mjs --live` and is never printed. Preserve all secrets on redeployment.

## Delivery and recovery

The server checks the original signed order, checkout signature, fixed amount/currency, product metadata, capture status and refunds with Razorpay. Canonical payment records in Razorpay are the durable source of truth; there is no separate customer database or email sender. The browser stores its pending order in local storage and uses secure HttpOnly cookies. Check payment status recovers a lost callback from Razorpay.

After verification, the customer can download the files and save purchase details containing a signed private access link. That bearer link restores the purchase in a new browser, after another canonical payment/refund check. Access is valid for one year, as disclosed before purchase. Downloaded files remain usable. The support email handles cases where the customer loses both their browser access and saved link. Refunds/disputes block further delivery. Do not log receipt links, cookies, signatures or credentials.

No real payment is performed by automated checks. Deployment verification may create unpaid live orders and open checkout; a real transaction must be completed by the account owner/customer. Existing copies distributed before launch (including historical previews) cannot be recalled by removing the current free links.
