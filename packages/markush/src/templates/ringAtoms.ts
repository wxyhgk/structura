import type { Template } from "@structura/core/markush"
import type { Op } from "@structura/core/ops"
import { drawn, label, shelf } from "./build.ts"

// Atoms standing inside a ring (X in a fluorene-like or five-membered ring): an element,
// which takes its hydrogens (N is NH, C is CH2), or one atom with what it carries, drawn
// with both "*" on that atom.

/** One atom of `el` (atom 1) carrying these: a phenyl, a methyl, or a double-bonded O. */
function carrying(el: string, ...groups: Array<"Ph" | "Me" | "=O">): Op[] {
  const group = (kind: "Ph" | "Me" | "=O"): Op =>
    kind === "Ph" ? { op: "add_scaffold", name: "benzene", site: "C1", to: 1 } : kind === "Me" ? { op: "add_atom", el: "C", to: 1 } : { op: "add_atom", el: "O", to: 1, order: 2 }
  return [{ op: "place_atom", el, at: { x: 0, y: 0 } }, ...groups.map(group)]
}

/** Both "*" on atom 1. */
const onOne = (ops: Op[]) => drawn(ops, [1, 1])

export const ringAtoms = (): Template[] =>
  shelf("环内原子", "ring", [
    ["ring-o", "O", ["O", "oxygen"], label("O")],
    ["ring-s", "S", ["S", "sulfur"], label("S")],
    ["ring-nh", "NH", ["NH", "N-H"], label("N")],
    ["ring-ch2", "CH2", ["CH2", "methylene"], label("C")],
    ["ring-nme", "N–Me", ["NMe", "N-methyl"], onOne(carrying("N", "Me"))],
    ["ring-nph", "N–Ph", ["NPh", "N-phenyl"], onOne(carrying("N", "Ph"))],
    ["ring-cme2", "CMe2", ["CMe2", "dimethylmethylene"], onOne(carrying("C", "Me", "Me"))],
    ["ring-sime2", "SiMe2", ["SiMe2", "dimethylsilylene"], onOne(carrying("Si", "Me", "Me"))],
    ["ring-siph2", "SiPh2", ["SiPh2", "diphenylsilylene"], onOne(carrying("Si", "Ph", "Ph"))],
    ["ring-co", "C=O", ["C=O", "CO", "carbonyl"], onOne(carrying("C", "=O"))],
    ["ring-so2", "SO2", ["SO2", "sulfonyl"], onOne(carrying("S", "=O", "=O"))],
  ])
