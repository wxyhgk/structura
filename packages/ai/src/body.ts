import type { IncomingMessage } from "node:http"

const TOO_LARGE = "请求太大"

/**
 * A request's JSON body, read up to `limit` characters, or the error to answer with when
 * it runs past that or is not JSON.
 */
export async function readJsonBody(req: IncomingMessage, limit: number): Promise<{ value: unknown } | { error: string }> {
  try {
    let text = ""
    for await (const chunk of req) {
      text += chunk
      if (text.length > limit) throw new Error(TOO_LARGE)
    }
    return { value: JSON.parse(text) }
  } catch (error) {
    return { error: error instanceof Error && error.message === TOO_LARGE ? TOO_LARGE : "请求不是有效的 JSON" }
  }
}
