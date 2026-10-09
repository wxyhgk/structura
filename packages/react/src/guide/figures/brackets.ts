import type { Point } from "@structura/core/types"
import { enumerate, ringSystemPositions } from "@structura/markush"
import { build, once } from "./build.ts"

// Pictures for the brackets page.

/** A zigzag of `count` atoms from the origin, as the chain tool draws it. */
const zigzag = (count: number): Point[] => Array.from({ length: count }, (_, index) => ({ x: index * 35, y: index % 2 ? -20 : 0 }))

/** A phenanthrene in a group bracket, a substituent hanging off it. */
export const groupBracket = once(() =>
  build([
    { op: "add_scaffold", name: "phenanthrene" },
    { op: "add_bracket", atoms: Array.from({ length: 14 }, (_, index) => index + 1) },
    { op: "add_atom", el: "C", to: 3, as: "r" },
    { op: "label", atom: "r", text: "R1" },
  ]),
)

/** MeO–[CH2]n–CH2CH2–OH: one carbon as a repeat unit, the bonds running through its brackets. */
export const repeatBracket = once(() =>
  build([
    { op: "draw_chain", points: zigzag(6) },
    { op: "label", atom: 1, text: "MeO" },
    { op: "label", atom: 6, text: "OH" },
    { op: "add_bracket", atoms: [3], kind: "repeat" },
  ]),
)

/** A two-carbon repeat unit counted m. */
export const longerRepeat = once(() =>
  build([
    { op: "draw_chain", points: zigzag(6) },
    { op: "add_bracket", atoms: [3, 4], kind: "repeat", repeat: { min: 1, max: 4, name: "m" } },
  ]),
)

/**
 * As patents draw it: triphenylene in a group bracket with (Rx)n anywhere on it (an ellipse
 * inside the bracket), and L1 outside joined at any position of the bracketed group (a bond
 * through "]" ending inside).
 */
export const intoBracket = once(() => {
  const ring = build([
    { op: "add_scaffold", name: "phenanthrene", at: { x: 0, y: 0 }, as: "p" },
    { op: "add_ring", bond: { between: ["p.C9", "p.C10"] }, kind: "benzene" },
  ])
  const atoms = ring.molecule.atoms
  const system = atoms.map((atom) => atom.id)
  const left = Math.min(...atoms.map((atom) => atom.x))
  const right = Math.max(...atoms.map((atom) => atom.x))
  const ys = atoms.map((atom) => atom.y)
  const rx = ring.molecule.nextAtomId
  return build(
    [
      { op: "place_atom", el: "C", at: { x: left + 10, y: Math.max(...ys) + 50 } },
      { op: "label", atom: rx, text: "Rx" },
      { op: "set_attachment", atom: rx, to: ringSystemPositions(ring.molecule, [system[0]])!, repeat: { min: 0, max: 4, name: "n" } },
      { op: "add_bracket", atoms: [...system, rx] },
      { op: "place_atom", el: "C", at: { x: right + 130, y: (Math.min(...ys) + Math.max(...ys)) / 2 } },
      { op: "label", atom: rx + 1, text: "L1" },
      { op: "set_attachment", atom: rx + 1, to: [...system, rx] },
    ],
    ring,
  )
})

/** Cl–[CH2]n–OH, n = 1–3, and what generating it gives: the unit written out once, twice, three times. */
export const repeatExpanded = once(() => {
  const drawing = build([
    { op: "draw_chain", points: zigzag(4) },
    { op: "label", atom: 1, text: "Cl" },
    { op: "label", atom: 4, text: "OH" },
    { op: "add_bracket", atoms: [2], kind: "repeat", repeat: { min: 1, max: 3, name: "n" } },
  ])
  return { drawing, products: enumerate(drawing).molecules.map((molecule) => ({ molecule, arrows: [], nextArrowId: 1 })) }
})

/** A bracket round a labelled group: OMe on a ring, its label inside. */
export const labelledBracket = once(() =>
  build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 1, as: "o" },
    { op: "label", atom: "o", text: "OMe" },
    { op: "add_bracket", atoms: [7, 8] },
  ]),
)
