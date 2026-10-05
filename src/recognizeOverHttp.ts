import { STRUCTURE_PATH, type StructureEvent, type StructureRequest } from "@structura/ai"

/**
 * Sends a picture to this app's own server (the dev server's structuraAi plugin, which holds
 * the API key) and hands back each event of the answer as its line arrives.
 */
export async function recognizeOverHttp(request: StructureRequest, onEvent: (event: StructureEvent) => void, signal: AbortSignal): Promise<void> {
  const response = await fetch(STRUCTURE_PATH, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request), signal })
  if (!response.body || !/json/.test(response.headers.get("content-type") ?? "")) {
    onEvent({ type: "result", result: { ok: false, error: `服务器没有提供识别接口（${response.status}）。请用 npm run dev 或 npm run preview 启动。` } })
    return
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ""
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line) as StructureEvent)
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as StructureEvent)
}
