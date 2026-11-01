import { createHandler } from '../payments-test/handler.js'
import { products, publicPaths } from './manifest.generated.js'
// A separate deployment and signing key isolate real purchases from all test grants.
export default { fetch: createHandler({ products, publicPaths, mode: 'live' }) }
