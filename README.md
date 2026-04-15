# ImageSqueeze

Browser-only image compressor and resizer built with React + Vite.

## Run locally

```bash
npm install
npm run dev
```

## Embed mode (single reusable engine)

Use the same app URL and pass `embed=1` plus optional preconfiguration query params.

Supported params:

- `target` (number)
- `unit` (`KB` or `MB`)
- `format` (`jpeg`, `png`, `webp`)
- `quality` (1-100, used when `target` is not set)
- `width` (1-10000)
- `height` (1-10000)
- `keepAspect` (`1` or `0`)
- `label` (short badge text)

Example iframe:

```html
<iframe
  src="https://your-domain.com/?embed=1&target=200&unit=KB&format=jpeg&label=Pre-configured%3A%20Under%20200%20KB"
  width="100%"
  height="760"
  loading="lazy"
  style="border:0"
></iframe>
```

Invalid or missing values safely fall back to defaults.

## Quality checks

```bash
npm test
npm run lint
npm run build
```
