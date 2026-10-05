import type OpenAI from "openai"
import type { Effort } from "../openai.ts"
import type { Ask } from "./agent.ts"
import { STRUCTURE_PROMPT } from "./prompt.ts"
import { firstObject } from "./json.ts"

/** The agent's turns through the OpenAI Responses API (or any server speaking it): strict JSON, nothing stored. */
export function openaiAsk(client: OpenAI, model: string, effort?: Effort): Ask {
  return async (turns, format) => {
    const response = await client.responses.create({
      model,
      instructions: STRUCTURE_PROMPT,
      store: false,
      // Left out, the server picks; reading a picture's locants needs real thought.
      ...(effort ? { reasoning: { effort } } : {}),
      input: turns.map((turn) =>
        turn.role === "assistant"
          ? { type: "message" as const, role: "assistant" as const, content: turn.text }
          : {
              // The type is optional for OpenAI, but some compatible servers insist on it.
              type: "message" as const,
              role: "user" as const,
              content: [{ type: "input_text" as const, text: turn.text }, ...(turn.images ?? []).map((url) => ({ type: "input_image" as const, image_url: url, detail: "high" as const }))],
            },
      ),
      text: { format: { type: "json_schema", name: format.name, schema: format.schema, strict: true } },
    })
    const parts = response.output.flatMap((item) => (item.type === "message" ? item.content : []))
    if (parts.some((part) => part.type === "refusal")) throw new Error(`${model} 拒绝了这张图。`)
    if (response.status === "incomplete") throw new Error(`${model} 没有答完（${response.incomplete_details?.reason ?? "原因不明"}）。`)
    return firstObject(response.output_text)
  }
}
