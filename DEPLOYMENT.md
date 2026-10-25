# Aeroniqx deployment

The complete previous production artifact was recovered from Cloudflare deployment
`312c5019-ce54-4b5d-a127-ce84018f3a5a` (104 files). It is retained unchanged in
`legacy-site/`, with SHA-256 checksums in `deployment/production-baseline.json`.
The older React files in this checkout are incomplete and are not the production
build source. GitHub Actions deploys this complete artifact to the existing
Cloudflare Pages project. Direct uploads remain available for recovery.

## GitHub deployment

Repository: `Techazzer/image-squeezer`. Workflow:
`.github/workflows/cloudflare-pages.yml`.

- Pull requests to `main` run tests, build the site, and verify preserved routes,
  assets, metadata, and hosting rules. They do not receive Cloudflare credentials.
- Pushes to `main` deploy production only after all checks pass.
- Actions → Aeroniqx checks and deployment → Run workflow, on `main`, offers
  `preview` (default) or `production`. Preview uses the `github-preview` branch
  in Cloudflare and does not clear the live domain's cache.
- Production deploys refresh the aeroniqx.in cache and verify the homepage,
  calculator, and exact release assets. The run summary contains the deployed URL.
- The CLI is pinned in `deployment/cli/`; the build itself needs no packages.
  GitHub actions are pinned to upstream commit hashes. The workflow token has
  only `contents: read` permission.

Required repository configuration under Settings → Secrets and variables → Actions:

| Type | Name | Purpose |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | Account Cloudflare Pages Edit for the deployment account, plus Zone Cache Purge restricted to aeroniqx.in. |
| Variable | `CLOUDFLARE_ZONE_ID` | The aeroniqx.in zone ID used to refresh its cache. |

The Cloudflare account ID and Pages project name are fixed in
`scripts/deploy-cloudflare.mjs`. Cloudflare's Pages token permission applies to
the account's Pages projects; the workflow targets only `image-resizer`.
Store the token only as a GitHub encrypted Actions secret. Do not commit it or
copy Wrangler's personal OAuth credentials into GitHub. Renew or revoke the CI
token in Cloudflare when needed and replace the repository secret.

Cloudflare direct-upload projects cannot be converted to native Git integration;
this uses the supported [GitHub Actions workflow](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
while retaining the existing project, domain, and rollback history.

## Source and build

- `tools/work-hours/`: editable HTML, CSS, JavaScript and pure calculation module.
- `scripts/build-site.mjs`: verifies the baseline, copies all original routes,
  adds the new page, and applies guarded catalog/navigation changes to the
  recovered compiled bundle. A changed integration point stops the build.
- Existing tool implementations and original asset URLs are preserved. New
  navigation uses a content-hashed entry bundle. Advertising script loaders are
  removed and empty ad slots hidden in the release.
- `deployment/_headers` and `_redirects`: original Cloudflare configuration.
- `deployment/site-shell.json`: existing rendered header/footer used to match the
  new page to the site. The new page links to the homepage's All Tools section.

Requires Node.js 18 or newer. This static build and calculator need no installed
packages or paid services. The existing package dependencies are only for older
React sources; do not use those incomplete sources to replace the whole site.

```powershell
npm run build
npm test
node scripts/check-build.mjs
npm run preview
```

Preview: `http://127.0.0.1:4173`. Stop it with Ctrl+C. Deploy the **contents of
dist**, not this repository (which contains source and recovery metadata).

```powershell
..\cloudflare.cmd pages deploy dist --project-name image-resizer --branch codex-work-hours
# After preview verification, deploy the same dist to production:
..\cloudflare.cmd pages deploy dist --project-name image-resizer --branch main
```

The parent-folder Cloudflare wrapper is authenticated for the existing account;
credentials remain in Wrangler's encrypted store and Windows Credential Manager.
Do not copy credentials into source or the deployment folder.

## Calculator behavior

One shift per day, seven dates starting from the chosen date. Whole-minute
calculations, unpaid breaks, automatic overnight shifts, explicit next-day option
for 24-hour shifts, daily **or** weekly overtime, optional gross pay in eight
currencies, CSV and clean print output, editable JSON backup/restore, and opt-in
local storage. It makes no server calls with timesheet entries. No ads or login.
Clock-time estimates do not adjust for daylight saving, split shifts, taxes,
deductions, or jurisdiction-specific payroll rules. These limits are described
on the page.

## Mobile web app

`tools/app-shell/` contains the mobile layout, tool library, install guidance,
icons and service worker. `scripts/mobile-app.mjs` adds this shell to all 91
indexable pages including the tool directory, generates the catalog, and writes a
standalone web app manifest. Desktop layouts remain in place; the app header and
bottom navigation appear at widths up to 720px. Use `Get app` on a phone for
Android installation or iPhone/iPad home-screen instructions. Installation is
always optional and explicitly initiated by the visitor.

Bookmarks use local storage on that device. No account, server storage, ads,
analytics or notification permission is added. The service worker precaches
public homepage and Work Hours HTML, their code/styles, and the tool catalog.
It never caches uploaded files or timesheet entries. Other tools show an offline
fallback when a network connection is unavailable. First-time offline use is
not supported. Existing opt-in timesheet storage is separate and unchanged.

Online navigation uses the network. Offline documents stay paired with their
precached assets until a complete new worker activates after existing tabs close;
updates do not force a reload during a calculation. Source changes generate a
new worker version and content-hashed app assets. Deployment checks verify all
of these assets on both the immutable Pages URL and aeroniqx.in.

The local-only `/__mobile-preview/` route displays the homepage and calculator
in 390px frames for layout QA. It is not included in the deployed site.

`scripts/platform-pages.mjs` owns the maintained homepage, `/tools/` directory,
About, Privacy and `llms.txt`. `scripts/tool-content.mjs` holds shared tool
descriptions, task-search synonyms, categories and six editorial featured picks.
These are not popularity rankings. The full catalog remains linked in static
HTML in the directory; the homepage does not repeat every preset. Do not restore
the old image-compressor-to-home rewrite: the image tool has its own directory.

Search opens from the homepage within the original tap event and focuses the
input before any network work, allowing mobile browsers to raise the keyboard.
The library has a fixed viewport-sized mobile layout and a scrollable results
region. VisualViewport resize/scroll events update its height and top offset;
supported browsers also receive `interactive-widget=resizes-content`. The
result count never controls dialog size. Work/Creative/etc. category buttons
browse without raising the keyboard until the visitor chooses the input.

For future content, start with a recurring task and a working tool. Each tool
page should explain its purpose, inputs, steps, a useful example, assumptions
and limits, related tools, and sources when factual guidance needs them. Use
titles and structured data that match visible content. Validate usability and
accuracy before publishing; measure search discovery and completed tasks when
appropriate measurement is available. Never fabricate expertise, usage rankings
or reviews. `llms.txt` is a descriptive index, not a ranking guarantee.

## Recovery and future additions

The SEO build adds initial HTML for 13 core pages and generates the sitemap
from all indexable output pages. See `tools/prerender/README.md` for snapshot
maintenance. The homepage uses static links and native FAQ controls without
loading the tool application. Its search metadata is defined in
`scripts/seo.mjs`. The build verifies every indexable page has a unique title,
an initial H1, valid JSON-LD, a sitemap entry and working local link targets.

The work-hours page renders empty rows at build time. Keep the shared
`timesheet-view.js` renderer aligned with its browser controller to preserve
layout space before JavaScript initializes dates and saved user data.

Keep the recovered artifact and checksum manifest intact. For future tools,
add maintainable source beside `tools/work-hours/` and extend the guarded build.
If the original complete project becomes available, migrate the catalog changes
into that source instead. The recovered bundle is an intentional preservation
measure, not a reconstruction of the missing React project.

Cloudflare retains previous deployments. The baseline deployment above is the
pre-calculator rollback target. Use the Cloudflare deployment rollback UI if a
release must be reverted; do not delete previous deployments.
