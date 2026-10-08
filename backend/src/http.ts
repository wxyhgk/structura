import type { IncomingMessage, ServerResponse } from "node:http"

// JSON in and out over node:http: reading a request body (at most 2 MB), answering with JSON,
// and the errors the API names.

/** The largest request body accepted. */
export const MAX_BODY_BYTES = 2 * 1024 * 1024

/** An error with the status to answer it with; its message goes to the client. */
export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * The request's body parsed as JSON. Throws HttpError 413 when it is over the limit (the rest
 * is read and dropped so the client still gets the answer) and 400 when it is not JSON.
 */
export async function readJson(req: IncomingMessage, limit = MAX_BODY_BYTES): Promise<unknown> {
  const declared = Number(req.headers["content-length"])
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size <= limit) chunks.push(chunk)
    // A client that keeps sending far past the limit is cut off rather than drained.
    else if (size > limit * 8) {
      req.destroy()
      break
    }
  }
  if (size > limit || declared > limit) throw new HttpError(413, `the request body is over ${limit / 1024 / 1024} MB`)
  const text = Buffer.concat(chunks).toString("utf8")
  if (!text.trim()) throw new HttpError(400, "the request has no JSON body")
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, "the request body is not valid JSON")
  }
}

/** Answers with `body` as JSON. */
export function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const text = JSON.stringify(body)
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(text), ...headers })
  res.end(text)
}

/** Answers with no body. */
export function sendEmpty(res: ServerResponse, status: number): void {
  res.writeHead(status)
  res.end()
}

/** Answers `{ error }` with the status the API gives the error; anything unexpected is a 500, logged. */
export function sendError(res: ServerResponse, error: unknown): void {
  if (error instanceof HttpError) return sendJson(res, error.status, { error: error.message }, error.status === 413 ? { Connection: "close" } : {})
  console.error(error)
  if (res.headersSent) return void res.destroy()
  sendJson(res, 500, { error: "internal error" })
}
