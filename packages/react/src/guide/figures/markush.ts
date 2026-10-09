import { type Alternative, enumerate, ringSystemPositions } from "@structura/markush"
import type { Drawing } from "@structura/core/types"
import { build, label, once, star } from "./build.ts"

// Pictures for the generic-formula pages.

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

/**
 * Curved attachments over fused systems, as patents draw them: (R1)n anywhere on naphthalene
 * (an ellipse round it), and –L2 joined anywhere on carbazole (the bond sweeping round it).
 */
export const curvedAttachments = once(() => {
  const loop = build([
    { op: "add_scaffold", name: "naphthalene", at: { x: 0, y: 0 } },
    { op: "place_atom", el: "C", at: { x: 125, y: -85 } },
    { op: "label", atom: 11, text: "R1" },
  ])
  const arc = build([
    { op: "add_scaffold", name: "carbazole", at: { x: 0, y: 0 } },
    { op: "place_atom", el: "C", at: { x: -150, y: -10 } },
    { op: "label", atom: 14, text: "L2" },
    { op: "place_atom", el: "C", at: { x: -195, y: -75 } },
    { op: "label", atom: 15, text: "Ar" },
    { op: "add_bond", a: 14, b: 15 },
  ])
  return {
    loop: build([{ op: "set_attachment", atom: 11, to: ringSystemPositions(loop.molecule, [1])!, repeat: { min: 0, max: 4, name: "n" } }], loop),
    arc: build([{ op: "set_attachment", atom: 14, to: ringSystemPositions(arc.molecule, [1])! }], arc),
  }
})
