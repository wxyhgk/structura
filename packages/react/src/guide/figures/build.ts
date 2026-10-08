import { emptyDrawing } from "@structura/core"
import { sceneToSvg } from "@structura/core/draw"
import { applyOps, type Op } from "@structura/core/ops"
import type { Alternative, Drawing } from "@structura/core/types"

// Making the guide's pictures: drawn by the same ops and renderer as the editor, so a
// picture always shows what the editor really does.

export function build(ops: Op[], from: Drawing = emptyDrawing()): Drawing {
  const result = applyOps(from, ops)
  if (!result.ok) throw new Error(`guide figure: op ${result.index}: ${result.error}`)
  return result.drawing
}

/**
 * A drawing as SVG text, its variable attachments drawn the way the canvas draws them, on
 * no background of its own, so it sits on whatever card the page puts it on.
 */
export function figureSvg(drawing: Drawing): string {
  const svg = sceneToSvg(drawing.molecule, true, drawing.arrows, drawing.attachments).replace(/<rect [^>]*fill="#ffffff"\s*\/>\n?/, "")
  const atoms = new Map(drawing.molecule.atoms.map((atom) => [atom.id, atom]))
  const lines = (drawing.attachments ?? []).flatMap((attachment) => {
    const from = atoms.get(attachment.atom)
    const targets = attachment.to.flatMap((id) => atoms.get(id) ?? [])
    if (!from || targets.length === 0) return []
    const to = { x: targets.reduce((sum, atom) => sum + atom.x, 0) / targets.length, y: targets.reduce((sum, atom) => sum + atom.y, 0) / targets.length }
    // Leave room for the label the line starts from.
    const gap = from.alias ? 11 / Math.hypot(to.x - from.x, to.y - from.y) : 0
    const start = { x: from.x + (to.x - from.x) * gap, y: from.y + (to.y - from.y) * gap }
    return [`<line x1="${start.x}" y1="${start.y}" x2="${to.x}" y2="${to.y}" stroke="#222" stroke-width="1.55" stroke-linecap="round"/>`]
  })
  return lines.length > 0 ? svg.replace("</svg>", `${lines.join("")}</svg>`) : svg
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

