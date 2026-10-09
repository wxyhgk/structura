import { emptyDrawing } from "@structura/core"
import { sceneToSvg } from "@structura/core/draw"
import { applyOps, type Op } from "@structura/core/ops"
import type { Drawing } from "@structura/core/types"
import type { Alternative } from "@structura/markush"

// Making the guide's pictures: drawn by the same ops and renderer as the editor, so a
// picture always shows what the editor really does.

export function build(ops: Op[], from: Drawing = emptyDrawing()): Drawing {
  const result = applyOps(from, ops)
  if (!result.ok) throw new Error(`guide figure: op ${result.index}: ${result.error}`)
  return result.drawing
}

/**
 * A drawing as SVG text, its variable attachments drawn the way the canvas draws them (the
 * renderer shares their geometry), on no background of its own, so it sits on whatever
 * card the page puts it on.
 */
export function figureSvg(drawing: Drawing): string {
  return sceneToSvg(drawing.molecule, true, drawing.arrows, drawing.attachments, {}, { brackets: drawing.brackets }).replace(/<rect [^>]*fill="#ffffff"\s*\/>\n?/, "")
}

/** Built the first time it is shown, then kept: the pictures never change. */
export function once<T>(make: () => T): () => T {
  let made: { value: T } | null = null
  return () => (made ??= { value: make() }).value
}

export const label = (text: string): Alternative => ({ kind: "label", text })
export const star = (to: string | number, as: string): Op[] => [
  { op: "add_atom", el: "C", to, as },
  { op: "label", atom: as, text: "*" },
]

