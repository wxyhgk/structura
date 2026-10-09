import type { Template } from "./model.ts"
import { at, drawn, label, scaffold, shelf } from "./build.ts"

// Aryl groups at a branch end. Where a patent's name covers several positions ("naphthyl"),
// the piece joins by each of them in turn (alsoAt); a fixed position is in the name.

export const arylGroups = (): Template[] =>
  shelf("芳基", "end", [
    ["phenyl", "苯基", ["Ph", "phenyl"], label("Ph")],
    ["naphthyl", "萘基（1-/2-位）", ["naphthyl", "Naph"], drawn([scaffold("naphthalene")], at("C1"), at("C2"))],
    ["biphenyl-4-yl", "联苯-4-基", ["biphenyl-4-yl", "Biph", "4-biphenylyl"], label("Biph")],
    ["anthryl", "蒽基（1-/2-/9-位）", ["anthryl", "anthracenyl"], drawn([scaffold("anthracene")], at("C1"), at("C2", "C9"))],
    ["phenanthryl", "菲基（1-/2-/3-/4-/9-位）", ["phenanthryl", "phenanthrenyl"], drawn([scaffold("phenanthrene")], at("C1"), at("C2", "C3", "C4", "C9"))],
    [
      "9-9-dimethylfluoren-2-yl",
      "9,9-二甲基芴-2-基",
      ["9,9-dimethylfluoren-2-yl", "dimethylfluorenyl"],
      drawn([scaffold("fluorene"), { op: "add_atom", el: "C", to: "s.C9" }, { op: "add_atom", el: "C", to: "s.C9" }], at("C2")),
    ],
    [
      "triphenylenyl",
      "三亚苯基（1-/2-位）",
      ["triphenylenyl", "triphenylen-2-yl"],
      // Phenanthrene with a benzo ring on its 9,10-bond is triphenylene; b.C3 is next to a fusion atom.
      drawn([scaffold("phenanthrene"), { op: "add_scaffold", name: "benzene", edge: "a", onto: { between: ["s.C9", "s.C10"] }, as: "b" }], ["b.C3"], ["b.C4"]),
    ],
  ])
