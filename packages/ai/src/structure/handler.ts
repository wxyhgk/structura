import type { IncomingMessage, ServerResponse } from "node:http"
import type { Provider } from "../provider.ts"
import { structureProblem, type StructureEvent, type StructureRequest } from "./types.ts"

async function body(req: IncomingMessage, limit: number): Promise<string> {
  let text = ""
  for await (const chunk of req) {
    text += chunk
    if (text.length > limit) throw new Error("请求太大")
  }
  return text
}

/**
 * A Node HTTP handler for POSTed StructureRequests: the agent runs, and each step is
 * written back as a JSON line as it happens, the result last. If the browser goes away
 * (the dialog is closed), the agent stops.
 */
export function structureHandler(provider: Provider | { error: string }) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const fail = (status: number, error: string) => {
      res.statusCode = status
      res.setHeader("content-type", "application/json; charset=utf-8")
      res.end(JSON.stringify({ type: "result", result: { ok: false, error } } satisfies StructureEvent))
    }
    if (req.method !== "POST") return fail(405, "只接受 POST")
    let request: unknown
    try {
      request = JSON.parse(await body(req, 15_000_000))
    } catch (error) {
      return fail(400, error instanceof Error && error.message === "请求太大" ? "请求太大" : "请求不是有效的 JSON")
    }
    const problem = structureProblem(request)
    if (problem) return fail(400, problem)
    if ("error" in provider) return fail(503, provider.error)
    const stop = new AbortController()
    res.on("close", () => stop.abort())
    res.statusCode = 200
    res.setHeader("content-type", "application/x-ndjson; charset=utf-8")
    res.setHeader("cache-control", "no-cache")
    const write = (event: StructureEvent) => res.write(`${JSON.stringify(event)}\n`)
    const result = await provider.recognize(request as StructureRequest, (step) => write({ type: "step", step }), stop.signal)
    if (!res.writableEnded) {
      write({ type: "result", result })
      res.end()
    }
  }
}
