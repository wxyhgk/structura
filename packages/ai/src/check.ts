import type { FillAnswer, FillRequest, FillResult } from "./types.ts"

// What every model provider shares: checking the browser's request, and reading the answer.

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

/** The model's JSON text as an answer. The schema held it to its shape; reviewAnswer checks the rest. */
export function answerFrom(text: string, model: string): FillResult {
  try {
    return { ok: true, answer: JSON.parse(text) as FillAnswer }
  } catch {
    return { ok: false, error: `${model} 的回答不是有效的 JSON。` }
  }
}

/** Shown when a call fails before reaching the API, most often for want of a key. */
export const KEY_HINT = "如果服务器还没有设置密钥，请在项目根目录的 .env.local 里写上，然后重启开发服务器。"
