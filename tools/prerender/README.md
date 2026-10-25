# Initial HTML for the recovered application

The thirteen JSON files contain public, initial rendered markup captured from
the deployed application on 2026-10-25. They contain no uploaded files, account
credentials or visitor timesheets. Their interactive tools still mount from the
preserved application bundle. The build inserts this visible content into the
initial HTML so crawlers and visitors do not receive an empty application shell.

`scripts/seo.mjs` owns search titles, canonical URLs, page-specific structured
data and shared copy corrections. It generates the sitemap from all built
indexable HTML pages. No network access or browser is needed during builds.

Update these snapshots when changing the recovered application's visible
content, until the original complete component source can be restored. Keep
the initial content consistent with the interactive page; do not add content
visible only to crawlers. New standalone tools should ship their own semantic
HTML directly, as the work-hours calculator does.
