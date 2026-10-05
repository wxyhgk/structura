import { BUILD_TEXT, startText } from "./prompt.ts"
import { renderForModel } from "./render.ts"
import { ACTION, READING, type Format } from "./schema.ts"
import { createSession, valenceProblems } from "./session.ts"
import type { Action, Reading, StructureRequest, StructureResult, StructureStep, Turn } from "./types.ts"

/** One turn of a model: the conversation so far in, an answer in the given shape out. */
export type Ask = (turns: Turn[], format: Format) => Promise<unknown>

/** The most turns before it stops and hands back what it has (the reading included). */
export const MOST_STEPS = 16

/**
 * The agent loop. First the model reads the picture and says what it shows, a name and a
 * description with locants, building nothing: seeing and building are separate jobs, and
 * models place substituents far better from a name than straight from a picture. Then it
 * builds what it read one action at a time on a scratch drawing (build, look, reset) until
 * it says done or runs out of steps. Each step is reported as it happens; the result is the
 * drawing it ended with.
 */
export async function recognize(request: StructureRequest, askOnce: Ask, onStep: (step: StructureStep) => void, signal?: AbortSignal): Promise<StructureResult> {
  // A model now and then answers with nothing usable (an empty or cut-off reply); one more try usually does it.
  const ask: Ask = async (turns, format) => {
    try {
      return await askOnce(turns, format)
    } catch {
      if (signal?.aborted) throw new Error("已停止。")
      return askOnce(turns, format)
    }
  }
  const session = createSession()
  const turns: Turn[] = [{ role: "user", text: startText(request.hint), images: [request.image] }]
  const stopped = (): StructureResult => ({ ok: false, error: "已停止。", drawing: session.drawing() })
  const failed = (error: unknown): StructureResult => ({ ok: false, error: error instanceof Error ? error.message : String(error), drawing: session.drawing() })

  if (signal?.aborted) return stopped()
  let reading: Reading
  try {
    reading = (await ask(turns, READING)) as Reading
  } catch (error) {
    return failed(error)
  }
  turns.push({ role: "assistant", text: JSON.stringify(reading) }, { role: "user", text: BUILD_TEXT })
  onStep({ note: reading.note, action: "read", ok: true, message: [reading.name, reading.description].filter(Boolean).join("\n"), drawing: session.drawing() })

  for (let step = 2; step <= MOST_STEPS; step++) {
    if (signal?.aborted) return stopped()
    let action: Action
    try {
      action = (await ask(turns, ACTION)) as Action
    } catch (error) {
      return failed(error)
    }
    turns.push({ role: "assistant", text: JSON.stringify(action) })
    // A drawing with an over-full atom is never right; done is refused until it is fixed.
    const problems = action.action === "done" ? valenceProblems(session.drawing().molecule) : []
    if (problems.length > 0 && step < MOST_STEPS) {
      const message = `Not done: the drawing has valence problems (${problems.join("; ")}). Fix them first.`
      onStep({ note: action.note, action: "done", ok: false, message, drawing: session.drawing() })
      turns.push({ role: "user", text: message })
      continue
    }
    if (action.action === "done") {
      onStep({ note: action.note, action: "done", ok: true, message: "完成", drawing: session.drawing() })
      return session.drawing().molecule.atoms.length > 0 ? { ok: true, drawing: session.drawing(), steps: step } : { ok: false, error: "AI 没有画出任何结构。" }
    }
    const outcome = session.act(action)
    onStep({ note: action.note, action: action.action, ok: outcome.ok, message: outcome.message, drawing: session.drawing() })
    const picture = action.action === "look" ? renderForModel(session.drawing(), session.names()) : null
    turns.push({
      role: "user",
      text: `${outcome.message}${action.action === "look" ? (picture ? "\nHere is your drawing, each atom's id and locant name in brown. Compare it with the original picture and with your reading, position by position: for every bond between ring systems and every substituent, check that it sits on the locant you read." : "\nThere is nothing to show yet.") : ""}${step === MOST_STEPS - 1 ? "\nOne turn left: finish with done." : ""}`,
      images: picture ? [picture] : undefined,
    })
  }
  const drawing = session.drawing()
  return drawing.molecule.atoms.length > 0 ? { ok: true, drawing, steps: MOST_STEPS } : { ok: false, error: "步数用完了，还没有画出结构。" }
}
