import type OpenAI from "openai"
import type { Effort } from "../openai.ts"
import type { Ask } from "./agent.ts"
import { firstObject } from "./json.ts"
import { ACTION, type Format } from "./schema.ts"
import { STRUCTURE_PROMPT } from "./prompt.ts"

/**
 * The agent's turns through the older Chat Completions API, for servers that offer only that
 * (Zhipu's open.bigmodel.cn, many local servers). JSON is asked for in the prompt and the
 * schema is shown there; the answer is streamed, so a long think does not hit a timeout.
 */

/**
 * Without enforced schemas there is no need for ops as an escaped string (needed only by
 * strict mode, which cannot describe every op); a plain array is shorter and some models
 * stumble over the escaping. The session takes either.
 */
function shown(format: Format): Record<string, unknown> {
  if (format !== ACTION) return format.schema
  const properties = format.schema.properties as Record<string, unknown>
  return { ...format.schema, properties: { ...properties, ops: { type: "array", items: { type: "object" }, description: "For build: the ops; otherwise []" } } }
}

export function chatAsk(client: OpenAI, model: string, effort?: Effort): Ask {
  return async (turns, format) => {
    const stream = await client.chat.completions.create({
      model,
      stream: true,
      // Some servers default to a short answer; a build can be long, and thinking counts too.
      max_tokens: 16384,
      ...(effort ? { reasoning_effort: effort } : {}),
      messages: [
        { role: "system", content: `${STRUCTURE_PROMPT}\n\nThis turn, answer with one JSON object matching this schema:\n${JSON.stringify(shown(format))}` },
        ...turns.map((turn) =>
          turn.role === "assistant"
            ? { role: "assistant" as const, content: turn.text }
            : { role: "user" as const, content: [{ type: "text" as const, text: turn.text }, ...(turn.images ?? []).map((url) => ({ type: "image_url" as const, image_url: { url } }))] },
        ),
      ],
    })
    let text = ""
    let finish: string | null = null
    for await (const chunk of stream) {
      text += chunk.choices[0]?.delta?.content ?? ""
      finish = chunk.choices[0]?.finish_reason ?? finish
    }
    if (finish === "length") throw new Error(`${model} 的回答被截断了。`)
    try {
      return firstObject(text)
    } catch (error) {
      throw new Error(`${error instanceof Error ? error.message : String(error)}（结束原因：${finish ?? "无"}）`)
    }
  }
}
