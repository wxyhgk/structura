import type OpenAI from "openai"
import type { NextAction } from "./agent.ts"
import { STRUCTURE_PROMPT } from "./prompt.ts"
import { ACTION_SCHEMA } from "./schema.ts"
import { firstObject } from "./json.ts"
import type { Action } from "./types.ts"

/** The agent's turns through the OpenAI Responses API (or any server speaking it): strict JSON, nothing stored. */
export function openaiNext(client: OpenAI, model: string): NextAction {
  return async (turns) => {
    const response = await client.responses.create({
      model,
      instructions: STRUCTURE_PROMPT,
      store: false,
      input: turns.map((turn) =>
        turn.role === "assistant"
          ? { role: "assistant" as const, content: turn.text }
          : {
              role: "user" as const,
              content: [{ type: "input_text" as const, text: turn.text }, ...(turn.images ?? []).map((url) => ({ type: "input_image" as const, image_url: url, detail: "high" as const }))],
            },
      ),
      text: { format: { type: "json_schema", name: "structure_action", schema: ACTION_SCHEMA, strict: true } },
    })
    const parts = response.output.flatMap((item) => (item.type === "message" ? item.content : []))
    if (parts.some((part) => part.type === "refusal")) throw new Error(`${model} 拒绝了这张图。`)
    if (response.status === "incomplete") throw new Error(`${model} 没有答完（${response.incomplete_details?.reason ?? "原因不明"}）。`)
    return firstObject(response.output_text) as Action
  }
}
