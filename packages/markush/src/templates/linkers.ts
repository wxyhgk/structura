import type { Template } from "@structura/core/markush"
import type { Op } from "@structura/core/ops"
import { at, bridge, drawn, label, range, scaffold, shelf } from "./build.ts"

// Linkers between two atoms (L): a direct bond, a divalent ring, or a one-atom bridge. The
// rings core already builds as bridges are used as such; the others are drawn with a "*" on
// each of the two atoms that take the bonds. An element (O, S, N, C) takes its hydrogens.

const carbonyl: Op[] = [
  { op: "place_atom", el: "C", at: { x: 0, y: 0 } },
  { op: "add_atom", el: "O", to: 1, order: 2 },
]

const ethynylene: Op[] = [
  { op: "place_atom", el: "C", at: { x: 0, y: 0 } },
  { op: "add_atom", el: "C", to: 1, order: 3, as: "c2" },
]

const dimethylfluorene: Op[] = [scaffold("fluorene"), { op: "add_atom", el: "C", to: "s.C9" }, { op: "add_atom", el: "C", to: "s.C9" }]

export const linkers = (): Template[] =>
  shelf("连接基", "link", [
    ["bond", "单键", ["bond", "direct bond"], { kind: "bond" }],
    ["p-phenylene", "对亚苯基", ["p-phenylene", "1,4-phenylene"], bridge("p-phenylene")],
    ["m-phenylene", "间亚苯基", ["m-phenylene", "1,3-phenylene"], bridge("m-phenylene")],
    ["o-phenylene", "邻亚苯基", ["o-phenylene", "1,2-phenylene"], drawn([scaffold("benzene")], at("C1", "C2"))],
    ["4-4-biphenylene", "4,4'-亚联苯基", ["4,4'-biphenylene", "biphenyl-4,4'-diyl"], bridge("4,4'-biphenylene")],
    ["2-6-naphthylene", "2,6-亚萘基", ["2,6-naphthylene", "naphthalene-2,6-diyl"], drawn([scaffold("naphthalene")], at("C2", "C6"))],
    ["1-4-naphthylene", "1,4-亚萘基", ["1,4-naphthylene", "naphthalene-1,4-diyl"], drawn([scaffold("naphthalene")], at("C1", "C4"))],
    ["9-9-dimethylfluorene-2-7-diyl", "9,9-二甲基芴-2,7-二基", ["9,9-dimethylfluorene-2,7-diyl"], drawn(dimethylfluorene, at("C2", "C7"))],
    ["2-5-pyridinediyl", "吡啶-2,5-二基", ["2,5-pyridinediyl", "pyridine-2,5-diyl"], bridge("2,5-pyridinediyl")],
    ["thiophene-2-5-diyl", "噻吩-2,5-二基", ["thiophene-2,5-diyl", "2,5-thienylene"], drawn([scaffold("thiophene")], at("C2", "C5"))],
    ["oxy", "–O–", ["O", "oxy", "ether"], label("O")],
    ["thio", "–S–", ["S", "thio", "sulfide"], label("S")],
    ["imino", "–NH–", ["NH", "imino", "amine"], label("N")],
    ["methylene", "–CH2–", ["CH2", "methylene"], label("C")],
    ["carbonyl", "–C(=O)–", ["C(=O)", "CO", "carbonyl"], drawn(carbonyl, [1, 1])],
    ["ethynylene", "–C≡C–", ["ethynylene", "C#C"], drawn(ethynylene, [1, "c2"])],
    ["arylene-c6-c30", "C6–C30 亚芳基", ["arylene"], range("arylene", 6, 30)],
    ["heteroarylene-c2-c30", "C2–C30 亚杂芳基", ["heteroarylene"], range("heteroarylene", 2, 30, "carbons")],
  ])
