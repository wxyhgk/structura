import OpenAI from "openai"
import { answerFrom, KEY_HINT } from "./check.ts"
import { SYSTEM_PROMPT, userMessage } from "./prompt.ts"
import { ANSWER_SCHEMA } from "./schema.ts"
import type { FillRequest, FillResult } from "./types.ts"

/** Used when OPENAI_MODEL does not name one. */
export const OPENAI_MODEL = "gpt-5.5"

/**
 * Asks an OpenAI model, or any server speaking the OpenAI Responses API, to read the
 * variable definitions. The answer is held to ANSWER_SCHEMA (strict structured output);
 * the patent text is not stored on the provider's side.
 */
export async function askOpenAI(client: OpenAI, request: FillRequest, model = OPENAI_MODEL): Promise<FillResult> {
  try {
    const response = await client.responses.create({
      model,
      instructions: SYSTEM_PROMPT,
      input: userMessage(request),
      reasoning: { effort: "high" },
      max_output_tokens: 32000,
      store: false,
      text: { format: { type: "json_schema", name: "variable_definitions", schema: ANSWER_SCHEMA, strict: true } },
    })
    const content = response.output.flatMap((item) => (item.type === "message" ? item.content : []))
    if (content.some((part) => part.type === "refusal")) return { ok: false, error: `${model} 拒绝了这段文字，没有给出结果。` }
    if (response.status === "incomplete") {
      const reason = response.incomplete_details?.reason
      return { ok: false, error: reason === "max_output_tokens" ? "回答太长被截断了，请分几段粘贴。" : `${model} 没有答完（${reason ?? "原因不明"}）。` }
    }
    return answerFrom(response.output_text, model)
  } catch (error) {
    return { ok: false, error: failure(error) }
  }
}

/** What went wrong with the call, for the chemist. */
export function failure(error: unknown): string {
  if (error instanceof OpenAI.AuthenticationError) return "API key 无效，请检查服务器上的 OPENAI_API_KEY。"
  if (error instanceof OpenAI.PermissionDeniedError) return "这个 API key 没有权限使用该模型。"
  if (error instanceof OpenAI.NotFoundError) return `找不到模型或接口（${error.message}）。请检查 OPENAI_MODEL，以及 OPENAI_BASE_URL 是否支持 Responses API。`
  if (error instanceof OpenAI.RateLimitError) return "请求太频繁或额度不足，请稍后再试。"
  if (error instanceof OpenAI.APIConnectionError) return "连不上 OpenAI 接口，请检查服务器的网络和 OPENAI_BASE_URL。"
  if (error instanceof OpenAI.APIError) return `OpenAI 接口出错（${error.status ?? "无状态码"}）：${error.message}`
  return `调用失败：${error instanceof Error ? error.message : String(error)}。${KEY_HINT}（OPENAI_API_KEY=…）`
}
