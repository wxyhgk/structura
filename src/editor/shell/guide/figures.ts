import { emptyDrawing } from "@structura/core"
import { sceneToSvg } from "@structura/core/draw"
import { enumerate } from "@structura/core/markush"
import { applyOps, type Op } from "@structura/core/ops"
import type { Alternative, Drawing } from "@structura/core/types"
import { hotkeyOps } from "@/editor/hotkeys/lookup"

// The guide's pictures, drawn by the same ops and renderer as the editor, so a picture
// always shows what the editor really does.

function build(ops: Op[], from: Drawing = emptyDrawing()): Drawing {
  const result = applyOps(from, ops)
  if (!result.ok) throw new Error(`guide figure: op ${result.index}: ${result.error}`)
  return result.drawing
}

/** A drawing as SVG text, its variable attachments drawn the way the canvas draws them. */
export function figureSvg(drawing: Drawing): string {
  const svg = sceneToSvg(drawing.molecule, true, drawing.arrows)
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
function once<T>(make: () => T): () => T {
  let made: { value: T } | null = null
  return () => (made ??= { value: make() }).value
}

const label = (text: string): Alternative => ({ kind: "label", text })
const star = (to: string | number, as: string): Op[] => [
  { op: "add_atom", el: "C", to, as },
  { op: "label", atom: as, text: "*" },
]

/** Hover keys, through the real key table: a bond, then 1 on its end, then A on the new end. */
export const hoverSteps = once(() => {
  const press = (drawing: Drawing, key: string) => {
    const tip = drawing.molecule.atoms.at(-1)!.id
    return build(hotkeyOps(drawing.molecule, { type: "atom", id: tip }, key)!, drawing)
  }
  const bond = build([{ op: "place_atom", el: "C", at: { x: 0, y: 0 } }, { op: "add_atom", el: "C", to: 1, angle: Math.PI / 6 }])
  const chain = press(bond, "1")
  return [bond, chain, press(chain, "a")]
})

/** The bond kinds: single, double, triple, wedge and hash on one chain. */
export const bondKinds = once(() =>
  build([
    { op: "place_atom", el: "C", at: { x: 0, y: 0 } },
    { op: "add_atom", el: "C", to: 1, order: 2, angle: Math.PI / 6, as: "b" },
    { op: "add_atom", el: "C", to: "b", angle: -Math.PI / 6, as: "c" },
    { op: "add_atom", el: "C", to: "c", order: 3, angle: Math.PI / 6, as: "d" },
    { op: "add_atom", el: "C", to: "d", angle: Math.PI / 6, as: "e" },
    { op: "add_atom", el: "O", to: "e", stereo: "up", angle: Math.PI / 2 },
    { op: "add_atom", el: "C", to: "e", stereo: "down", angle: -Math.PI / 6 },
  ]))

/** Rings three ways: on a chain end (cyclohexylbenzene), fused on a bond (naphthalene), spiro on a ring atom. */
export const ringWays = once(() => [
  build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }, { op: "add_atom", el: "C", to: 1, as: "end" }, { op: "add_ring", atom: "end", kind: "cyclohexane" }]),
  build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }, { op: "add_ring", bond: { between: [1, 2] }, kind: "benzene" }]),
  build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "cyclohexane" }, { op: "add_ring", atom: 1, kind: "cyclopentane" }]),
])

/** Labels: OH and NH2 written with their hydrogens, Me and Boc kept as labels. */
export const labelled = once(() =>
  build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 1, as: "o" },
    { op: "label", atom: "o", text: "OH" },
    { op: "add_atom", el: "C", to: 4, as: "n" },
    { op: "label", atom: "n", text: "NH2" },
    { op: "add_atom", el: "C", to: 2, as: "m" },
    { op: "label", atom: "m", text: "Me" },
    { op: "add_atom", el: "C", to: 6, as: "b" },
    { op: "label", atom: "b", text: "OMe" },
  ]))

/** A generic formula: a dibenzo five-ring with X in the ring, R1 on it, and –L–Ar1. */
export const formula = once(() =>
  build([
    { op: "add_ring", at: { x: 0, y: 0 }, size: 5 },
    { op: "label", atom: 1, text: "X" },
    { op: "add_ring", bond: { between: [2, 3] }, kind: "benzene" },
    { op: "add_ring", bond: { between: [4, 5] }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 8, as: "l" },
    { op: "label", atom: "l", text: "L" },
    { op: "add_atom", el: "C", to: "l", as: "ar" },
    { op: "label", atom: "ar", text: "Ar1" },
    { op: "add_atom", el: "C", to: 13, as: "r" },
    { op: "label", atom: "r", text: "R1" },
  ]))

/** R1 attached anywhere on a ring, and the three places it can go on toluene. */
export const attachment = once(() => {
  const drawing = build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 1 },
    { op: "place_atom", el: "C", at: { x: 10, y: 95 } },
    { op: "label", atom: 8, text: "R1" },
    { op: "set_attachment", atom: 8, to: [2, 3, 4, 5, 6] },
    { op: "set_variable", name: "R1", alternatives: [label("Cl")] },
  ])
  return { drawing, products: enumerate(drawing).molecules.slice(0, 3) }
})

/** Pieces with their "*": carbazol-9-yl (one), 2,6-naphthylene (two ends), N–R5 for a ring (both on N). */
export const pieces = once(() => {
  const carbazolyl = build([
    { op: "add_ring", at: { x: 0, y: 0 }, size: 5 },
    { op: "label", atom: 1, text: "N" },
    { op: "add_ring", bond: { between: [2, 3] }, kind: "benzene" },
    { op: "add_ring", bond: { between: [4, 5] }, kind: "benzene" },
    ...star(1, "s"),
  ])
  const naphthylene = build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_ring", bond: { between: [1, 2] }, kind: "benzene" },
    ...star(4, "a"),
    ...star(9, "b"),
  ])
  const nR5 = build([
    { op: "place_atom", el: "N", at: { x: 0, y: 0 } },
    { op: "add_atom", el: "C", to: 1, as: "r", angle: Math.PI / 2 },
    { op: "label", atom: "r", text: "R5" },
    ...star(1, "a"),
    ...star(1, "b"),
  ])
  return { carbazolyl, naphthylene, nR5 }
})

/** The formula with the pieces as alternatives, and a few of the compounds it expands to. */
export const expanded = once(() => {
  const { carbazolyl, naphthylene, nR5 } = pieces()
  const piece = (drawing: Drawing): Alternative => ({ kind: "fragment", molecule: drawing.molecule })
  const drawing = build(
    [
      { op: "set_variable", name: "X", alternatives: [label("O"), piece(nR5)] },
      { op: "set_variable", name: "R5", alternatives: [label("Ph")] },
      { op: "set_variable", name: "L", alternatives: [{ kind: "bond" }, piece(naphthylene)] },
      { op: "set_variable", name: "Ar1", alternatives: [piece(carbazolyl)] },
      { op: "set_variable", name: "R1", alternatives: [label("H")] },
    ],
    formula(),
  )
  return enumerate(drawing).molecules
})
