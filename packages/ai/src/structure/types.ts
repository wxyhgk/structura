import type { Drawing } from "@structura/core/types"

/** One turn of the conversation, as the agent loop keeps it, whichever model answers. */
export type Turn = { role: "user" | "assistant"; text: string; images?: string[] }

/** What the model asks for in a turn: one action, and a short note for the chemist watching. */
export type Action = {
  /** What it is doing, in a few words of Chinese ("搭咔唑骨架", "对比渲染图"). */
  note: string
  action: "build" | "look" | "reset" | "done"
  /** For build: the ops as a JSON array; empty otherwise. */
  ops: string
}

/** The first turn's answer: what the model reads in the picture, before it builds. */
export type Reading = { note: string; name: string; description: string }

/** Something to tell the chemist while the agent works: a step taken (read is the first), with the drawing as it now is. */
export type StructureStep = { note: string; action: Action["action"] | "read"; ok: boolean; message: string; drawing: Drawing }

/** How a recognition run ended. */
export type StructureResult = { ok: true; drawing: Drawing; steps: number } | { ok: false; error: string; drawing?: Drawing }

/** What the editor sends: the picture (a data URL) and, optionally, a hint ("这是专利里的通式"). */
export type StructureRequest = { image: string; hint?: string }

/** Where the dev server answers StructureRequests (POST, JSON in; one JSON event per line out). */
export const STRUCTURE_PATH = "/api/ai/structure"

/** One line of the answer: a step as it happens, then the result. */
export type StructureEvent = { type: "step"; step: StructureStep } | { type: "result"; result: StructureResult }

/** Why a picture cannot be sent, or null. It comes from a browser, so nothing is assumed. */
export function structureProblem(request: unknown): string | null {
  if (typeof request !== "object" || request === null) return "请求不是 JSON 对象"
  const { image, hint } = request as Partial<StructureRequest>
  if (typeof image !== "string" || !/^data:image\/(png|jpeg|gif|webp);base64,/.test(image)) return "图片要是 PNG、JPEG、GIF 或 WebP"
  if (image.length > 14_000_000) return "图片太大（最多约 10 MB），请截取结构所在的部分"
  if (hint != null && (typeof hint !== "string" || hint.length > 2000)) return "说明文字太长"
  return null
}
