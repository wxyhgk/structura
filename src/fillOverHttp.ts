import { FILL_PATH, type FillRequest, type FillResult } from "@structura/ai"

/**
 * Sends a FillRequest to this app's own server (the dev server's structuraAi plugin), which
 * holds the API key. A page served without that endpoint, or an answer that is not a fill
 * result, gets a plain explanation.
 */
export async function fillOverHttp(request: FillRequest): Promise<FillResult> {
  const response = await fetch(FILL_PATH, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) })
  if (!response.headers.get("content-type")?.includes("application/json")) return { ok: false, error: `服务器没有提供 AI 接口（${response.status}）。请用 npm run dev 或 npm run preview 启动。` }
  const result = (await response.json().catch(() => null)) as Partial<FillResult> | null
  return typeof result?.ok === "boolean" ? (result as FillResult) : { ok: false, error: `服务器的回答读不懂（${response.status}），请重试。` }
}
