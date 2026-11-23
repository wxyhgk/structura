import type { IncomingMessage, ServerResponse } from "node:http"

// JSON in and out over node:http: reading a request body (at most 2 MB, and only as the type the
// route asks for), answering with JSON, and the errors the API names.

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
 * Throws HttpError 415 unless the request's Content-Type is `type` (parameters such as charset
 * aside). Browsers send text/plain, form and multipart bodies cross-site without asking first;
 * any other type needs a preflight, which this server never answers, so a page on another
 * origin cannot reach a route that requires one.
 */
export function requireContentType(req: IncomingMessage, type: string): void {
  const sent = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase()
  if (sent !== type) throw new HttpError(415, `the request needs Content-Type: ${type}`)
}

/**
 * The request's body. Throws HttpError 413 when it is over the limit (the rest is read and
 * dropped so the client still gets the answer).
 */
export async function readBody(req: IncomingMessage, limit = MAX_BODY_BYTES): Promise<Buffer> {
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
  return Buffer.concat(chunks)
}

/**
 * The request's body parsed as JSON. Throws HttpError 415 when it is not sent as
 * application/json, 413 when it is over the limit, and 400 when it is not JSON.
 */
export async function readJson(req: IncomingMessage, limit = MAX_BODY_BYTES): Promise<unknown> {
  requireContentType(req, "application/json")
  const text = (await readBody(req, limit)).toString("utf8")
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
  if (error instanceof HttpError) return sendJson(res, error.status, { error: error.message }, error.status === 413 || error.status === 415 ? { Connection: "close" } : {})
  console.error(error)
  if (res.headersSent) return void res.destroy()
  sendJson(res, 500, { error: "internal error" })
}
