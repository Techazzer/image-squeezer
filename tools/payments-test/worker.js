import { createHandler } from './handler.js'
import { products, publicPaths } from './manifest.generated.js'
export default { fetch: createHandler({ products, publicPaths }) }
