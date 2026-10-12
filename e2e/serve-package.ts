// Serves packages/react as plain files, the way a CDN serves the published package, so the
// standalone examples (packages/react/examples) run against the built dist/ with no bundler.
// Usage: node e2e/serve-package.ts <port>
import { createReadStream, statSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join, normalize } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("../packages/react/", import.meta.url))
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
}

const port = Number(process.argv[2])
createServer((request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url ?? "/", "http://x").pathname))
  const file = join(ROOT, path)
  if (!file.startsWith(ROOT) || !statSync(file, { throwIfNoEntry: false })?.isFile()) {
    response.writeHead(404).end()
    return
  }
  response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" })
  createReadStream(file).pipe(response)
}).listen(port, "127.0.0.1", () => console.log(`packages/react on http://127.0.0.1:${port}/`))
