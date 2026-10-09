import type { IncomingMessage, ServerResponse } from "node:http"
import { readJsonBody } from "./body.ts"
import { MAX_TEXT, requestProblem } from "./check.ts"
import { providerFrom, type AiEnv } from "./provider.ts"
import { structureHandler } from "./structure/handler.ts"
import { STRUCTURE_PATH } from "./structure/types.ts"
import { FILL_PATH, type FillRequest, type FillResult } from "./types.ts"

// The server side: the API key stays here, and the browser only ever sees FillResults.

export { askClaude, CLAUDE_MODEL } from "./claude.ts"
export { askOpenAI, OPENAI_MODEL } from "./openai.ts"
export { providerFrom, type AiEnv, type Provider } from "./provider.ts"
export { structureHandler } from "./structure/handler.ts"
export { FILL_PATH, STRUCTURE_PATH }

function send(res: ServerResponse, status: number, result: FillResult) {
  res.statusCode = status
  res.setHeader("content-type", "application/json; charset=utf-8")
  res.end(JSON.stringify(result))
}

/**
 * A Node HTTP handler for POST requests carrying a FillRequest. Mount it on any Node server
 * (Connect, Express, Vite's dev server). `env` chooses the provider and holds its key (see
 * AiEnv); it defaults to the process environment.
 */
export function fillHandler(env: AiEnv = process.env) {
  const provider = providerFrom(env)
  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "POST") return send(res, 405, { ok: false, error: "只接受 POST" })
    // The text limit plus room for the variables and JSON escaping.
    const read = await readJsonBody(req, MAX_TEXT * 4)
    if ("error" in read) return send(res, 400, { ok: false, error: read.error })
    const request = read.value
    const problem = requestProblem(request)
    if (problem) return send(res, 400, { ok: false, error: problem })
    if ("error" in provider) return send(res, 503, { ok: false, error: provider.error })
    send(res, 200, await provider.ask(request as FillRequest))
  }
}

/** A Vite plugin serving fillHandler at FILL_PATH and structureHandler at STRUCTURE_PATH, for `vite` and `vite preview`. */
export function structuraAi(env: AiEnv = process.env) {
  const handler = fillHandler(env)
  const structure = structureHandler(providerFrom(env))
  const mount = (server: { middlewares: { use(path: string, handle: typeof handler): unknown } }) => {
    server.middlewares.use(FILL_PATH, handler)
    server.middlewares.use(STRUCTURE_PATH, structure)
  }
  return { name: "structura-ai", configureServer: mount, configurePreviewServer: mount }
}
