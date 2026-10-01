import type { IncomingMessage, ServerResponse } from "node:http"
import Anthropic from "@anthropic-ai/sdk"
import { fillVariables, MAX_TEXT, requestProblem } from "./claude.ts"
import { FILL_PATH, type FillRequest, type FillResult } from "./types.ts"

// The server side: the API key stays here, and the browser only ever sees FillResults.

export { fillVariables, MODEL } from "./claude.ts"
export { FILL_PATH }

async function body(req: IncomingMessage): Promise<string> {
  let text = ""
  for await (const chunk of req) {
    text += chunk
    // The text limit plus room for the variables and JSON escaping.
    if (text.length > MAX_TEXT * 4) throw new Error("请求太大")
  }
  return text
}

function send(res: ServerResponse, status: number, result: FillResult) {
  res.statusCode = status
  res.setHeader("content-type", "application/json; charset=utf-8")
  res.end(JSON.stringify(result))
}

/**
 * A Node HTTP handler for POST requests carrying a FillRequest. Mount it on any Node server
 * (Connect, Express, Vite's dev server); `apiKey` defaults to the SDK's own lookup
 * (ANTHROPIC_API_KEY and friends).
 */
export function fillHandler({ apiKey }: { apiKey?: string } = {}) {
  // Made on first use; without credentials the call itself says so.
  let client: Anthropic | null = null
  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "POST") return send(res, 405, { ok: false, error: "只接受 POST" })
    let request: unknown
    try {
      request = JSON.parse(await body(req))
    } catch (error) {
      return send(res, 400, { ok: false, error: error instanceof Error && error.message === "请求太大" ? "请求太大" : "请求不是有效的 JSON" })
    }
    const problem = requestProblem(request)
    if (problem) return send(res, 400, { ok: false, error: problem })
    client ??= apiKey ? new Anthropic({ apiKey }) : new Anthropic()
    send(res, 200, await fillVariables(client, request as FillRequest))
  }
}

/** A Vite plugin serving fillHandler at FILL_PATH, for `vite` and `vite preview`. */
export function structuraAi(options: { apiKey?: string } = {}) {
  const handler = fillHandler(options)
  const mount = (server: { middlewares: { use(path: string, handle: typeof handler): unknown } }) => {
    server.middlewares.use(FILL_PATH, handler)
  }
  return { name: "structura-ai", configureServer: mount, configurePreviewServer: mount }
}
