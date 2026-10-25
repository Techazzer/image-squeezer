# Tools, presets and guides

`scripts/tool-content.mjs` is the explicit list of distinct tools shown in the app, the `/tools/` directory and the recovered desktop menu. Multiple pages using the same implementation must not become separate tools here.

`scripts/tool-catalog.mjs` maps existing embedded pages to their parent tool. All existing page URLs stay live and are linked from `/guides/`; the catalog stores their titles as search aliases. Unknown non-guide pages fail the build until classified.

`tools/app-shell/search.js` resolves each query to at most one result per tool. A specific file-size request opens the compressor with `target` and `unit` parameters. Named image presets reuse their existing settings; ambiguous queries open the parent tool. Normal app links use `preset=1` and preserve navigation; iframe links continue to use `embed=1`.

Saved preset bookmarks consolidate to the parent tool the next time the catalog loads. Only the canonical path, title and category are stored. Existing unknown bookmarks remain available.

When adding a tool, update the core catalog only for a distinct capability, add the actual implementation/page, and run the tests, build and `scripts/check-build.mjs`. When adding a preset, use its parent tool and retain a meaningful task-specific page. Do not edit `legacy-site/`; guarded build integrations preserve that recovery baseline.
