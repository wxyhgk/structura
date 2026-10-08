import type { Template } from "@structura/core/markush"
import type { Op } from "@structura/core/ops"
import { drawn, label, shelf } from "./build.ts"

// Saturated rings at a branch end: the carbocycles by their abbreviations, the heterocycles
// drawn (atoms 1… round the ring as add_ring numbers them), joined at the atom their name says.

/** A saturated ring of `size` with these ring atoms (by number) swapped for other elements. */
const ring = (size: 5 | 6, swaps: Record<number, string>): Op[] => [
  { op: "add_ring", at: { x: 0, y: 0 }, kind: size === 5 ? "cyclopentane" : "cyclohexane" },
  ...Object.entries(swaps).map(([atom, el]): Op => ({ op: "set_element", atom: Number(atom), el })),
]

export const saturatedGroups = (): Template[] =>
  shelf("饱和环", "end", [
    ["cyclopropyl", "环丙基", ["cPr", "cyclopropyl"], label("cPr")],
    ["cyclobutyl", "环丁基", ["cBu", "cyclobutyl"], label("cBu")],
    ["cyclopentyl", "环戊基", ["cPent", "cyclopentyl"], label("cPent")],
    ["cyclohexyl", "环己基", ["Cy", "cyclohexyl"], label("Cy")],
    ["cycloheptyl", "环庚基", ["cHept", "cycloheptyl"], label("cHept")],
    ["adamantyl", "1-金刚烷基", ["Ad", "1-adamantyl"], label("Ad")],
    ["pyrrolidin-1-yl", "吡咯烷-1-基", ["pyrrolidin-1-yl", "pyrrolidino"], drawn(ring(5, { 1: "N" }), [1])],
    ["piperidin-1-yl", "哌啶-1-基", ["piperidin-1-yl", "piperidino"], drawn(ring(6, { 1: "N" }), [1])],
    ["piperazin-1-yl", "哌嗪-1-基", ["piperazin-1-yl", "piperazinyl"], drawn(ring(6, { 1: "N", 4: "N" }), [1])],
    [
      "4-methylpiperazin-1-yl",
      "4-甲基哌嗪-1-基",
      ["4-methylpiperazin-1-yl", "N-methylpiperazinyl"],
      drawn([...ring(6, { 1: "N", 4: "N" }), { op: "add_atom", el: "C", to: 4 }], [1]),
    ],
    ["morpholino", "吗啉-4-基", ["morpholino", "morpholin-4-yl"], drawn(ring(6, { 1: "N", 4: "O" }), [1])],
    ["tetrahydropyranyl", "四氢吡喃基（2-/3-/4-位）", ["tetrahydropyranyl", "oxanyl"], drawn(ring(6, { 1: "O" }), [4], [2, 3])],
  ])
