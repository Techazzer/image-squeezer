# Aeroniqx direct-upload release

The complete previous production artifact was recovered from Cloudflare deployment
`312c5019-ce54-4b5d-a127-ce84018f3a5a` (104 files). It is retained unchanged in
`legacy-site/`, with SHA-256 checksums in `deployment/production-baseline.json`.
The older React files in this checkout are incomplete and are not the production
build source. No GitHub connection or GitHub push is needed for deployment.

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

## Recovery and future additions

Keep the recovered artifact and checksum manifest intact. For future tools,
add maintainable source beside `tools/work-hours/` and extend the guarded build.
If the original complete project becomes available, migrate the catalog changes
into that source instead. The recovered bundle is an intentional preservation
measure, not a reconstruction of the missing React project.

Cloudflare retains previous deployments. The baseline deployment above is the
pre-calculator rollback target. Use the Cloudflare deployment rollback UI if a
release must be reverted; do not delete previous deployments.
