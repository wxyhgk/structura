import { emptyDrawing } from "@structura/core"
import type { Op } from "@structura/core/ops"
import type { Drawing } from "@structura/core/types"
import { build } from "../figures/build.ts"
import type { Mark } from "../figures/marks.ts"
import type { CardSketch, GuideContext, PressKey, TutorialStep } from "../types.ts"

/**
 * Writing a tutorial: do what the user would (as ops, the editor's own), and after each
 * action record a step with what to say (keys in square brackets: "按 [1]") and what to mark.
 */
export class Walk {
  drawing: Drawing = emptyDrawing()
  readonly steps: TutorialStep[] = []

  /** Applies ops as the user's action would; returns the atoms it added, in order. */
  act(ops: Op[]): number[] {
    const before = new Set(this.drawing.molecule.atoms.map((atom) => atom.id))
    this.drawing = build(ops, this.drawing)
    return this.drawing.molecule.atoms.filter((atom) => !before.has(atom.id)).map((atom) => atom.id)
  }

  /** Shows a drawing in place of the current one (a generated compound, say) without changing it. */
  show(drawing: Drawing, text: string, marks?: Mark[], card?: CardSketch) {
    this.steps.push({ text, drawing, marks, card })
  }

  step(text: string, marks?: Mark[], card?: CardSketch) {
    this.show(this.drawing, text, marks, card)
  }

  /** The atom of `among` farthest from `from`: the para position of a ring, say. */
  farthest(from: number, among: number[]): number {
    const at = (id: number) => this.drawing.molecule.atoms.find((atom) => atom.id === id)!
    const origin = at(from)
    return among.reduce((best, id) => (Math.hypot(at(id).x - origin.x, at(id).y - origin.y) > Math.hypot(at(best).x - origin.x, at(best).y - origin.y) ? id : best))
  }

  /** The topmost of these atoms (smallest y on screen). */
  top(among: number[]): number {
    const y = (id: number) => this.drawing.molecule.atoms.find((atom) => atom.id === id)!.y
    return among.reduce((best, id) => (y(id) < y(best) ? id : best))
  }
}

/** Built once per key table (one per editor), then kept: tutorials do not change while it runs. */
export function perHost<T>(make: (context: GuideContext) => T): (context: GuideContext) => T {
  const made = new WeakMap<PressKey, T>()
  return (context) => {
    const known = made.get(context.pressKey)
    if (known) return known
    const value = make(context)
    made.set(context.pressKey, value)
    return value
  }
}

/** Presses `key` on `atom` through the host's key table, as the user would; returns the atoms added. */
export function press(walk: Walk, pressKey: PressKey, atom: number, key: string): number[] {
  const ops = pressKey(walk.drawing.molecule, atom, key)
  if (!ops) throw new Error(`guide tutorial: the key "${key}" does nothing on atom #${atom}`)
  return walk.act(ops)
}
