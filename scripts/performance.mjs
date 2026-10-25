import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

// The homepage is a directory, not a file-processing tool. Its links and native
// details elements work without loading the legacy application or PDF libraries.
export async function optimizeHomepage(dist) {
  const file = path.join(dist, 'index.html')
  let html = await readFile(file, 'utf8')
  html = html.replace(/<script\b[^>]*type="module"[^>]*><\/script>/g, '')
    .replace(/<div class="nav-dropdown-trigger">[\s\S]*?<\/div>/, '<a href="#tools" class="nav-link">All Tools</a>')
    .replace(/<button class="hamburger [^"]*"[^>]*>[\s\S]*?<\/button>/, '<a href="#tools" class="home-mobile-tools">All tools</a>')
    .replace(/<div class="mobile-drawer [^"]*"[^>]*>[\s\S]*?<\/nav><\/div>/, '')
  await writeFile(file, html)
}
