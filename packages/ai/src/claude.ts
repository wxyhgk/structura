import Anthropic from "@anthropic-ai/sdk"
import { answerFrom, KEY_HINT } from "./check.ts"
import { SYSTEM_PROMPT, userMessage } from "./prompt.ts"
import { ANSWER_SCHEMA } from "./schema.ts"
import type { FillRequest, FillResult } from "./types.ts"

export const CLAUDE_MODEL = "claude-opus-5-5"

/**
 * Asks Claude to read the variable definitions in `request.text`. The answer is held to
 * ANSWER_SCHEMA; whether its labels and classes are usable is checked afterwards, by
 * reviewAnswer, where the chemist can see it.
 */
export async function askClaude(client: Anthropic, request: FillRequest): Promise<FillResult> {
  try {
    const response = await client.beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      // A declined request is retried server-side on the model Anthropic recommends for it.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high", format: { type: "json_schema", schema: ANSWER_SCHEMA } },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage(request) }],
    })
    if (response.stop_reason === "refusal") return { ok: false, error: "Claude 拒绝了这段文字，没有给出结果。" }
    if (response.stop_reason === "max_tokens") return { ok: false, error: "回答太长被截断了，请分几段粘贴。" }
    return answerFrom(response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join(""), "Claude")
  } catch (error) {
    return { ok: false, error: failure(error) }
  }
}

/** What went wrong with the call, for the chemist. */
function failure(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "API key 无效，请检查服务器上的 ANTHROPIC_API_KEY。"
  if (error instanceof Anthropic.PermissionDeniedError) return "这个 API key 没有权限使用该模型。"
  if (error instanceof Anthropic.RateLimitError) return "请求太频繁，请稍后再试。"
  if (error instanceof Anthropic.APIConnectionError) return "连不上 Claude API，请检查服务器的网络。"
  if (error instanceof Anthropic.APIError) return `Claude API 出错（${error.status ?? "无状态码"}）：${error.message}`
  // Raised before any request is sent, most often because no credentials were found.
  return `调用失败：${error instanceof Error ? error.message : String(error)}。${KEY_HINT}（ANTHROPIC_API_KEY=…）`
}
