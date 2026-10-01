import { FILL_PATH, type FillRequest, type FillResult } from "@structura/ai"

/**
 * Sends a FillRequest to this app's own server (the dev server's structuraAi plugin), which
 * holds the API key. A page served without that endpoint gets a plain explanation.
 */
export async function fillOverHttp(request: FillRequest): Promise<FillResult> {
  const response = await fetch(FILL_PATH, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) })
  if (response.headers.get("content-type")?.includes("application/json")) return (await response.json()) as FillResult
  return { ok: false, error: `服务器没有提供 AI 接口（${response.status}）。请用 npm run dev 或 npm run preview 启动。` }
}
