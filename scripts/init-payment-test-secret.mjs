import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const wrangler = path.resolve(root, '../node_modules/wrangler/bin/wrangler.js')
const config = path.join(root, 'tools/payments-test/wrangler.jsonc')
function run(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [wrangler, ...args, '--config', config], { cwd: root, windowsHide: true, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: ['pipe', 'pipe', 'pipe'] })
    let output = '', error = ''
    child.stdout.on('data', chunk => { output += chunk })
    child.stderr.on('data', chunk => { error += chunk })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve(output) : reject(Error(`Secret setup failed (${code}). ${error.replace(/\u001b\[[0-9;]*m/g, '')}`)))
    child.stdin.end(input || '')
  })
}
const secrets = JSON.parse(await run(['secret', 'list']))
if (secrets.some(secret => secret.name === 'ACCESS_TOKEN_SECRET')) console.log('ACCESS_TOKEN_SECRET is already configured; preserved existing value.')
else {
  // The generated signing key exists only in memory and is passed through stdin.
  await run(['secret', 'put', 'ACCESS_TOKEN_SECRET'], randomBytes(32).toString('base64url') + '\n')
  console.log('ACCESS_TOKEN_SECRET securely configured. No secret value was written to disk or output.')
}
