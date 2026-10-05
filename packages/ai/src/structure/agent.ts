import { startText } from "./prompt.ts"
import { renderForModel } from "./render.ts"
import { createSession } from "./session.ts"
import type { Action, StructureRequest, StructureResult, StructureStep, Turn } from "./types.ts"

/** One turn of a model: the conversation so far in, the next action out. */
export type NextAction = (turns: Turn[]) => Promise<Action>

/** The most turns before it stops and hands back what it has. */
export const MOST_STEPS = 16

/**
 * The agent loop: the model sees the picture, then acts one step at a time on a scratch
 * drawing (build, look, reset) until it says done or runs out of steps. Each step is
 * reported as it happens; the result is the drawing it ended with.
 */
export async function recognize(request: StructureRequest, next: NextAction, onStep: (step: StructureStep) => void, signal?: AbortSignal): Promise<StructureResult> {
  const session = createSession()
  const turns: Turn[] = [{ role: "user", text: startText(request.hint), images: [request.image] }]
  for (let step = 1; step <= MOST_STEPS; step++) {
    if (signal?.aborted) return { ok: false, error: "已停止。", drawing: session.drawing() }
    let action: Action
    try {
      action = await next(turns)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error), drawing: session.drawing() }
    }
    turns.push({ role: "assistant", text: JSON.stringify(action) })
    if (action.action === "done") {
      onStep({ note: action.note, action: "done", ok: true, message: "完成", drawing: session.drawing() })
      return session.drawing().molecule.atoms.length > 0 ? { ok: true, drawing: session.drawing(), steps: step } : { ok: false, error: "AI 没有画出任何结构。" }
    }
    const outcome = session.act(action)
    onStep({ note: action.note, action: action.action, ok: outcome.ok, message: outcome.message, drawing: session.drawing() })
    const picture = action.action === "look" ? renderForModel(session.drawing()) : null
    turns.push({
      role: "user",
      text: `${outcome.message}${action.action === "look" ? (picture ? "\nHere is your drawing, ids in brown; compare it with the original picture." : "\nThere is nothing to show yet.") : ""}${step === MOST_STEPS - 1 ? "\nOne turn left: finish with done." : ""}`,
      images: picture ? [picture] : undefined,
    })
  }
  const drawing = session.drawing()
  return drawing.molecule.atoms.length > 0 ? { ok: true, drawing, steps: MOST_STEPS } : { ok: false, error: "步数用完了，还没有画出结构。" }
}
