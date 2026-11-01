# Business resource content

The current launch is live and free. `business-resources.json` supplies the shared library, business guide, product cards and download pages. The supplier pack has a ₹99 list price and the registration guide a ₹49 list price; both currently charge ₹0. “Buy Now” opens the complete download page without checkout or a phone-number form.

For each future video, collect:

- Topic/title, category and short description.
- Video URL (or script until published).
- Free guide material and dated sources for factual claims. Sections accept `id`, `title`, `intro`, `points` or a `checklist`.
- Each product's name, list price in paise, format, description and exact deliverables.
- Final files in `content/downloads/`, explicitly listed in the product's `files` array.
- Verification method/date and evidence for any supplier verification claims.
- Optional images and relevant existing tool URLs.

The user has explicitly requested **no product-data previews**. The product cards describe deliverables; supplier rows and guide contents are delivered in the downloaded files. Only published guides and complete products enter the build.

The free launch explicitly authorizes public file access. The build copies only allowlisted PDF/XLSX files, validates their signatures and gives them content-hashed URLs. Download headers request attachment delivery and exclude files from search indexing. Credentials and buyer information must never enter this static build.

There is no payment gateway or order creation. Nonzero selling prices fail validation. A future paid release needs a separate authenticated payment/delivery implementation and private storage for paid files. Changing a price alone cannot secure a public download; already distributed free files remain in recipients' possession.

Build and view with the project's normal commands. Routes:

- `/banana-leaf/`: standalone landing link for DMs. Only the banana-leaf guide and its offers appear.
- `/banana-leaf/banana-leaf-suppliers/` and `/banana-leaf/export-registration-guide/`: standalone delivery pages. Every topic link stays within this journey; there is no app shell, tools menu, library navigation or install prompt.
- `/resources/`: library and category/search controls.
- `/resources/banana-leaf-business/`: business guide and free product cards.
- `/resources/downloads/banana-leaf-suppliers/`: supplier PDF and Excel directory.
- `/resources/downloads/export-registration-guide/`: registration PDF.
- `/resources/cart/`: compatible access page for old cart bookmarks; no payment flow.

Set a resource's optional `landingSlug` to generate a standalone journey from the same content and files. Paths must be unique and cannot overwrite existing routes. The app-shell build intentionally excludes `standaloneResourcePages`; keep future payment confirmation/delivery routes inside the corresponding standalone path too. Razorpay is not connected in this release.

Build using `npm run build`, then `node scripts/check-build.mjs`. Run `npm test`. After deployment, run `node scripts/verify-resource-release.mjs https://aeroniqx.in` to check the current pages, app assets and exact download bytes. The service worker does not precache these resource files; online navigation receives the current app shell.
