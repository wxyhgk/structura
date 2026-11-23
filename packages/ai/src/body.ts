import type { IncomingMessage } from "node:http"

const TOO_LARGE = "请求太大"

/** Whether the request's Content-Type is `type`, parameters such as charset aside. */
function hasContentType(req: IncomingMessage, type: string): boolean {
  return (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase() === type
}

/**
 * A request's JSON body, read up to `limit` characters, or the error to answer with and its
 * status: 415 when it is not declared as application/json, 413 when it runs past the limit,
 * 400 when it is not JSON. Requiring the type is what keeps other web pages out: a cross-site
 * form or `fetch(..., { mode: "no-cors" })` can only send text/plain, form or multipart bodies
 * without a preflight, and this server answers no preflight.
 */
export async function readJsonBody(req: IncomingMessage, limit: number): Promise<{ value: unknown } | { error: string; status: number }> {
  if (!hasContentType(req, "application/json")) return { error: "请求要用 application/json", status: 415 }
  try {
    // Whole Buffers are joined before decoding: a chunk can end inside a multi-byte character.
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of req as AsyncIterable<Buffer>) {
      size += chunk.length
      // A character is at most 3 UTF-8 bytes per UTF-16 unit, so more bytes than that is surely over.
      if (size > limit * 3) throw new Error(TOO_LARGE)
      chunks.push(chunk)
    }
    const text = Buffer.concat(chunks).toString("utf8")
    if (text.length > limit) throw new Error(TOO_LARGE)
    return { value: JSON.parse(text) }
  } catch (error) {
    return error instanceof Error && error.message === TOO_LARGE ? { error: TOO_LARGE, status: 413 } : { error: "请求不是有效的 JSON", status: 400 }
  }
}
