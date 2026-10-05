import type Anthropic from "@anthropic-ai/sdk"
import { CLAUDE_MODEL } from "../claude.ts"
import type { Ask } from "./agent.ts"
import { STRUCTURE_PROMPT } from "./prompt.ts"
import { firstObject } from "./json.ts"

/** "data:image/png;base64,…" as Claude's image block. */
function imageBlock(url: string) {
  const match = /^data:(image\/(?:png|jpeg|gif|webp));base64,(.*)$/s.exec(url)
  if (!match) throw new Error("图片要是 PNG、JPEG、GIF 或 WebP")
  return { type: "image" as const, source: { type: "base64" as const, media_type: match[1] as "image/png" | "image/jpeg" | "image/gif" | "image/webp", data: match[2] } }
}

/** The agent's turns through Claude: strict JSON, the fixed prompt cached across turns. */
export function claudeAsk(client: Anthropic): Ask {
  return async (turns, format) => {
    const response = await client.beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: format.schema } },
      system: [{ type: "text", text: STRUCTURE_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: turns.map((turn) =>
        turn.role === "assistant" ? { role: "assistant" as const, content: turn.text } : { role: "user" as const, content: [{ type: "text" as const, text: turn.text }, ...(turn.images ?? []).map(imageBlock)] },
      ),
    })
    if (response.stop_reason === "refusal") throw new Error("Claude 拒绝了这张图。")
    if (response.stop_reason === "max_tokens") throw new Error("Claude 的回答被截断了。")
    return firstObject(response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join(""))
  }
}
