# Aeroniqx usage events

Browser → `https://aero-analytics.techazzer.workers.dev/v2/track` → SQLite
Durable Object → Google Sheets. No Apps Script, ads, login or paid plan is added.
The existing encrypted Worker secrets (`SHEET_ID`, `SHEETS_CLIENT_EMAIL`,
`SHEETS_PRIVATE_KEY`) remain in Cloudflare; never put them in browser code or Git.

## What is measured

| Event | Meaning |
| --- | --- |
| `page_view` | Initial page or client-side route, once per route change |
| `tool_start` | Explicit processing or first timesheet edit |
| `tool_success` | File output created, valid bill submitted, or first valid edited timesheet |
| `tool_error` | Generic allowlisted validation, processing or sharing failure |
| `tool_interaction` | Finance calculator edited or print requested; not a completed result |
| `download` | Browser download initiated, not confirmed disk persistence |
| `share_open` | Share requested with a prepared result |
| `share_complete` | Native share promise resolved; not confirmed recipient delivery |
| `share_cancel` | Native share cancelled |
| `share_fallback` | File download or WhatsApp-text fallback offered |
| `search_open`, `search_select` | Library opened / tool selected; never search text |
| `tool_save`, `app_install` | Bookmark changed / browser installation confirmed |

File processing outcomes cover image compression and the five PDF tools.
The recovered handwriting and Drive tools retain their explicit start/download
hooks; they do not claim completed outcomes without a reliable completion hook.
Automatically recalculating finance tools report interactions, not initial defaults.
Work Hours starts/successes are counted once per page visit, not per keystroke.

Payload fields are explicitly allowlisted in `schema.js`. No input values, bill
names or amounts, files, filenames, raw error messages, search text, query strings,
full referral URLs or IP addresses are stored in events. Device/browser are broad
categories; Cloudflare supplies country. Session IDs are random, per tab, and
expire after 30 minutes of inactivity. They do not identify a person across sites.
Do Not Track, Global Privacy Control and the Privacy page opt-out disable tracking.
Local previews and third-party embeds do not collect. Same-origin embeds may
report tool actions but do not add another page view.

## Sheets and delivery

Spreadsheet: `16D7X2W3WBSJHVFMzuZvguuw3C5iUhvuQcKXl_FRcRnM`.
Existing `page_views`, `tool_uses`, `downloads`, `errors` data and headers remain.
New `events_v2` contains the canonical event log, including unique IDs and source.
`analytics_summary` has live formulas starting with this release. Old historical
rows are not silently combined with the newer event definitions. New download
rows leave the legacy size column blank; sizes are no longer collected.

The browser sends batches, retains a maximum of 60 queued events in memory, and
retries twice. A tab has a 180-event limit per page load. Offline visits, closing
tabs, blockers and quotas can undercount; measurement never blocks tool use.

The collector validates origins, payload size (20 KB), event types/IDs/timestamps
and batches (20 events). An origin check is not authentication or bot prevention.
The public endpoint may still receive spoofed requests; do not treat it as an
audited accounting system. No raw IP-based tracking is added for rate limiting.

The Durable Object serializes writes and deduplicates IDs for seven days. It
keeps accepted events pending until Google confirms the write. A batch reserves
fixed row ranges in a durable transaction before sending, so a retry after an
ambiguous timeout writes identical rows instead of appending duplicates.
Cron flushes every minute, up to 600 events per run. Pending queue cap: 10,000.
Capacity per managed tab: 100,000 rows, including its header. Hitting a limit
reports an error and stops delivery; new events can be refused when the queue
fills. Cloudflare and Google free quotas also apply.

**Do not sort, insert or delete rows in managed raw tabs.** Use filter views and
separate analysis tabs; fixed row reservations depend on stable row positions.
Archive/export and coordinate a cursor reset or a new collector version before
reusing a full sheet. Do not delete the Durable Object independently: its row
reservations and IDs prevent duplicates after network failures.

`GET /health` exposes only version, configuration/initialization status, pending
count, last delivery timestamp and a generic error code. It contains no events
or credentials. `sheets_401/403`, `google_auth`, `sheet_headers`, `sheet_capacity`
or a growing queue require attention. A successful health response by itself
does not prove a specific event arrived; verify its ID in `events_v2`.

Verification requests use `test: true`; their source is `verification`. They
remain visible in `events_v2` but are excluded from summary and legacy tabs.
Do not send real personal data during tests. Existing old clients can continue
using `/track`, sanitized by the compatibility adapter.

## Release and recovery

```powershell
npm test
npm run build
node scripts/check-build.mjs
..\cloudflare.cmd deploy --config tools/analytics/wrangler.jsonc --dry-run
..\cloudflare.cmd deploy --config tools/analytics/wrangler.jsonc
```

Deploy the compatible Worker first, verify a test event in Sheets, then merge
the website PR for the existing GitHub→Cloudflare Pages deployment. Worker
deployments use locally authorized Workers Scripts access. GitHub's Pages/cache
token is intentionally unchanged; the Worker is not automatically deployed by
that workflow. SQLite Durable Objects are available on Workers Free, within its
quotas. No billing-plan upgrade is required by this configuration.

Retain prior Worker versions and the `analytics-v2` Durable Object migration.
A site rollback remains compatible with `/track`. For a collector problem,
fix/redeploy while keeping the same namespace and queue; reverting to the old
KV collector would reintroduce its data-loss behavior and leave the new queue
undelivered. No existing KV buffer is destructively cleared during migration.
