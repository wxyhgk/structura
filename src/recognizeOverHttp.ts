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
  await readStructureEvents(response.body, onEvent)
}

/** One line of the answer as an event, or null when it is not one (a proxy's page, a cut-off line). */
export function structureEventOf(line: string): StructureEvent | null {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return null
  }
  const event = value as Partial<StructureEvent> | null
  if (event?.type === "step" && typeof event.step === "object" && event.step !== null) return event as StructureEvent
  if (event?.type === "result" && typeof event.result?.ok === "boolean") return event as StructureEvent
  return null
}

/**
 * The answer's events, one JSON object a line, handed on as each line arrives. A line that is
 * not an event is passed over rather than ending the reading; an answer that ends without
 * its result gets one that says so, so the dialog never waits for nothing.
 */
export async function readStructureEvents(body: ReadableStream<BufferSource>, onEvent: (event: StructureEvent) => void): Promise<void> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ""
  let skipped = 0
  let ended = false
  const take = (line: string) => {
    if (!line.trim()) return
    const event = structureEventOf(line)
    if (!event) return void skipped++
    if (event.type === "result") ended = true
    onEvent(event)
  }
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    lines.forEach(take)
  }
  take(buffer)
  if (!ended) onEvent({ type: "result", result: { ok: false, error: skipped > 0 ? `服务器的回答读不懂（${skipped} 行不是识别结果），请重试。` : "识别中途断开了，没有结果，请重试。" } })
}
