import { readFile, appendFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'

const accountId = 'c6dc45311b3f186087681b93e4f683c1'
const project = 'image-resizer'
const productionOrigin = 'https://aeroniqx.in'
const token = process.env.CLOUDFLARE_API_TOKEN
const zoneId = process.env.CLOUDFLARE_ZONE_ID
const target = process.env.DEPLOY_TARGET
const commit = process.env.GITHUB_SHA
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

if (!['production', 'preview'].includes(target)) throw new Error('DEPLOY_TARGET must be production or preview.')
if (process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('Deployments must run from main.')
if (!token) throw new Error('Add the CLOUDFLARE_API_TOKEN repository secret before deploying.')
if (!/^[a-f0-9]{40}$/.test(commit || '')) throw new Error('A valid GitHub commit is required.')
if (target === 'production' && !/^[a-f0-9]{32}$/.test(zoneId || '')) throw new Error('Set the CLOUDFLARE_ZONE_ID repository variable before deploying.')

const branch = target === 'production' ? 'main' : 'github-preview'
const command = [
  'deployment/cli/node_modules/wrangler/bin/wrangler.js', 'pages', 'deploy', 'dist',
  '--project-name', project, '--branch', branch, '--commit-hash', commit,
  '--commit-message', `GitHub ${target} deployment ${commit.slice(0, 7)}`,
]
const result = await promisify(execFile)(process.execPath, command, {
  env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId, WRANGLER_SEND_METRICS: 'false', CI: 'true' },
  maxBuffer: 4 * 1024 * 1024,
})
process.stdout.write(result.stdout)
process.stderr.write(result.stderr)
const deploymentUrl = result.stdout.match(/https:\/\/[a-f0-9]+\.image-resizer-66w\.pages\.dev\b/)?.[0]
if (!deploymentUrl) throw new Error('Deployment completed but its immutable URL could not be read. Inspect Wrangler output before retrying.')

const build = JSON.parse(await readFile('deployment/build.json', 'utf8'))
const assetPaths = [build.entryBundle, build.pdfChunk, build.updatesCss, ...build.calculatorAssets, ...build.mobileApp.assets]
const expectedHashes = new Map(await Promise.all(assetPaths.map(async file => [file, sha256(await readFile(`dist/${file}`))])))
const homeTitle = (await readFile('dist/index.html', 'utf8')).match(/<title>([^<]+)<\/title>/)[1]

async function verify(origin) {
  const home = await fetch(`${origin}/`, { signal: AbortSignal.timeout(20000) })
  const homeHtml = await home.text()
  if (!homeHtml.includes(build.mobileApp.script) || !homeHtml.includes('rel="manifest"')) throw new Error(`Mobile app shell is missing at ${origin}`)
  if (!/\bno-cache\b/.test(home.headers.get('cache-control') || '')) throw new Error(`HTML cache revalidation is missing at ${origin}`)
  if (!home.ok || !homeHtml.includes(`<title>${homeTitle}</title>`) || !homeHtml.includes('id="tools"') || !homeHtml.includes('<h1') || homeHtml.includes(`<script type="module"`)) throw new Error(`Homepage is not serving the static release at ${origin}`)
  const pdf = await fetch(`${origin}/pdf-compress/`, { signal: AbortSignal.timeout(20000) })
  const pdfHtml = await pdf.text()
  if (!pdf.ok || !pdfHtml.includes(build.entryBundle) || !pdfHtml.includes('<h1')) throw new Error(`PDF tool is not serving this release at ${origin}`)
  const image = await fetch(`${origin}/image-compressor`, { signal: AbortSignal.timeout(20000) })
  if (!image.ok || !(await image.text()).includes(build.entryBundle)) throw new Error(`Image tool must resolve to its own page at ${origin}`)
  const directory = await fetch(`${origin}/tools/`, { signal: AbortSignal.timeout(20000) })
  if (!directory.ok || !(await directory.text()).includes('platform-directory')) throw new Error(`Full tool directory is missing at ${origin}`)
  const guides = await fetch(`${origin}/guides/`, { signal: AbortSignal.timeout(20000) })
  const guidesHtml = await guides.text()
  if (!guides.ok || !guidesHtml.includes(build.mobileApp.script) || !guidesHtml.includes('platform-resource-list')) throw new Error(`Guides and presets are missing at ${origin}`)
  const calculator = await fetch(`${origin}/work-hours-calculator/`, { signal: AbortSignal.timeout(20000) })
  if (!calculator.ok || !(await calculator.text()).includes('id="calculator-ui"')) throw new Error(`Calculator is unavailable at ${origin}`)
  for (const [file, expected] of expectedHashes) {
    const response = await fetch(`${origin}/${file}`, { signal: AbortSignal.timeout(20000) })
    if (!response.ok || sha256(Buffer.from(await response.arrayBuffer())) !== expected) throw new Error(`Release asset mismatch: ${origin}/${file}`)
  }
}

async function verifyWithRetry(origin) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try { await verify(origin); console.log(`Verified this release at ${origin}`); return }
    catch (error) {
      if (attempt === 6) throw error
      console.log(`Waiting for deployment propagation (${attempt}/6).`)
      await delay(5000)
    }
  }
}

await verifyWithRetry(deploymentUrl)
if (target === 'production') {
  // The domain has an additional cache in front of Pages. Refresh it so the
  // homepage and older tool pages stop pointing at the previous entry bundle.
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ purge_everything: true }),
    signal: AbortSignal.timeout(30000),
  })
  const body = await response.json()
  if (!response.ok || !body.success) throw new Error(`Deployment uploaded, but cache refresh failed (HTTP ${response.status}). Confirm the token has Cache Purge permission for aeroniqx.in.`)
  console.log('Refreshed the aeroniqx.in cache.')
  await verifyWithRetry(productionOrigin)
}

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Aeroniqx deployment\n\n- Target: ${target}\n- Commit: ${commit}\n- Verified deployment: ${deploymentUrl}\n- Calculator: ${target === 'production' ? productionOrigin : deploymentUrl}/work-hours-calculator/\n`)
}
