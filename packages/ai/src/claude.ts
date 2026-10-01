import Anthropic from "@anthropic-ai/sdk"
import { SYSTEM_PROMPT, userMessage } from "./prompt.ts"
import { ANSWER_SCHEMA } from "./schema.ts"
import type { FillAnswer, FillRequest, FillResult } from "./types.ts"

export const MODEL = "claude-opus-5-5"

/** Patent text beyond this is refused rather than cut short, so nothing is silently dropped. */
export const MAX_TEXT = 200_000

/** Why a request cannot be sent, or null. It comes from a browser, so nothing is assumed. */
export function requestProblem(request: unknown): string | null {
  if (typeof request !== "object" || request === null) return "请求不是 JSON 对象"
  const { text, variables } = request as Partial<FillRequest>
  if (typeof text !== "string" || !text.trim()) return "没有专利文字"
  if (text.length > MAX_TEXT) return `文字太长（${text.length} 字，最多 ${MAX_TEXT} 字），请只粘贴定义变量的那几段`
  if (!Array.isArray(variables) || variables.length > 200) return "变量列表不对"
  const valid = variables.every((variable) => typeof variable?.name === "string" && typeof variable.linker === "boolean" && typeof variable.onDrawing === "boolean")
  return valid ? null : "变量列表不对"
}

/**
 * Asks Claude to read the variable definitions in `request.text`. The answer is held to
 * ANSWER_SCHEMA; whether its labels and classes are usable is checked afterwards, by
 * reviewAnswer, where the chemist can see it.
 */
export async function fillVariables(client: Anthropic, request: FillRequest): Promise<FillResult> {
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
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
    const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("")
    try {
      return { ok: true, answer: JSON.parse(text) as FillAnswer }
    } catch {
      return { ok: false, error: "Claude 的回答不是有效的 JSON。" }
    }
  } catch (error) {
    return { ok: false, error: apiFailure(error) }
  }
}

/** What went wrong with the call, for the chemist. */
function apiFailure(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "API key 无效，请检查服务器上的 ANTHROPIC_API_KEY。"
  if (error instanceof Anthropic.PermissionDeniedError) return "这个 API key 没有权限使用该模型。"
  if (error instanceof Anthropic.RateLimitError) return "请求太频繁，请稍后再试。"
  if (error instanceof Anthropic.APIConnectionError) return "连不上 Claude API，请检查服务器的网络。"
  if (error instanceof Anthropic.APIError) return `Claude API 出错（${error.status ?? "无状态码"}）：${error.message}`
  // Raised before any request is sent, most often because no credentials were found.
  const message = error instanceof Error ? error.message : String(error)
  return `调用失败：${message}。如果服务器还没有设置密钥，请在项目根目录的 .env.local 里写上 ANTHROPIC_API_KEY=…，然后重启开发服务器。`
}
