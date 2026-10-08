import type { Template } from "@structura/core/markush"
import type { Op } from "@structura/core/ops"
import { at, drawn, scaffold, shelf } from "./build.ts"

// Heteroaryl groups at a branch end, drawn from the scaffold templates (numbered the IUPAC
// way) so every position is the one its name says. A name that covers several positions
// joins by each in turn (alsoAt). Of two positions that are tautomers of one another in the
// NH ring (imidazol-4-yl and -5-yl, benzimidazol-4-yl and -7-yl), only the first is listed.

/** A five-membered ring with one more heteroatom: imidazole from pyrrole (C3 → N), and so on. */
const azole = (name: string, locant: string): Op[] => [scaffold(name), { op: "set_element", atom: `s.${locant}`, el: "N" }]

/** A phenyl on a scaffold atom. */
const phenylOn = (locant: string): Op => ({ op: "add_scaffold", name: "benzene", site: "C1", to: `s.${locant}` })

export const heteroarylGroups = (): Template[] =>
  shelf("杂芳基", "end", [
    ["pyridyl", "吡啶基（2-/3-/4-位）", ["pyridyl", "Py", "pyridinyl"], drawn([scaffold("pyridine")], at("C2"), at("C3", "C4"))],
    ["pyrimidinyl", "嘧啶基（2-/4-/5-位）", ["pyrimidinyl", "Pyrim"], drawn([scaffold("pyrimidine")], at("C2"), at("C4", "C5"))],
    ["pyrazinyl", "吡嗪基", ["pyrazinyl", "pyrazin-2-yl"], drawn([scaffold("pyrazine")], at("C2"))],
    ["triazinyl", "1,3,5-三嗪-2-基", ["triazinyl", "1,3,5-triazin-2-yl"], drawn([scaffold("triazine")], at("C2"))],
    [
      "diphenyltriazinyl",
      "4,6-二苯基-1,3,5-三嗪-2-基",
      ["4,6-diphenyl-1,3,5-triazin-2-yl", "diphenyltriazinyl"],
      drawn([scaffold("triazine"), phenylOn("C4"), phenylOn("C6")], at("C2")),
    ],
    ["thienyl", "噻吩基（2-/3-位）", ["thienyl", "thiophenyl"], drawn([scaffold("thiophene")], at("C2"), at("C3"))],
    ["furyl", "呋喃基（2-/3-位）", ["furyl", "furanyl"], drawn([scaffold("furan")], at("C2"), at("C3"))],
    ["pyrrolyl", "吡咯基（1-/2-/3-位）", ["pyrrolyl"], drawn([scaffold("pyrrole")], at("N1"), at("C2", "C3"))],
    ["pyrazolyl", "吡唑基（1-/3-/4-位）", ["pyrazolyl"], drawn(azole("pyrrole", "C2"), at("N1"), at("C3", "C4"))],
    ["imidazolyl", "咪唑基（1-/2-/4-位）", ["imidazolyl"], drawn(azole("pyrrole", "C3"), at("N1"), at("C2", "C4"))],
    ["thiazolyl", "噻唑基（2-/4-/5-位）", ["thiazolyl"], drawn(azole("thiophene", "C3"), at("C2"), at("C4", "C5"))],
    ["oxazolyl", "噁唑基（2-/4-/5-位）", ["oxazolyl"], drawn(azole("furan", "C3"), at("C2"), at("C4", "C5"))],
    ["indolyl", "吲哚基（1- 至 7-位）", ["indolyl"], drawn([scaffold("indole")], at("N1"), at("C2", "C3", "C4", "C5", "C6", "C7"))],
    ["quinolyl", "喹啉基（2- 至 8-位）", ["quinolyl", "quinolinyl"], drawn([scaffold("quinoline")], at("C2"), at("C3", "C4", "C5", "C6", "C7", "C8"))],
    ["isoquinolyl", "异喹啉基（1-、3- 至 8-位）", ["isoquinolyl", "isoquinolinyl"], drawn([scaffold("isoquinoline")], at("C1"), at("C3", "C4", "C5", "C6", "C7", "C8"))],
    ["benzofuranyl", "苯并呋喃基（2- 至 7-位）", ["benzofuranyl"], drawn([scaffold("benzofuran")], at("C2"), at("C3", "C4", "C5", "C6", "C7"))],
    ["benzothienyl", "苯并噻吩基（2- 至 7-位）", ["benzothienyl", "benzothiophenyl"], drawn([scaffold("benzothiophene")], at("C2"), at("C3", "C4", "C5", "C6", "C7"))],
    ["benzimidazolyl", "苯并咪唑基（1-/2-/4-/5-位）", ["benzimidazolyl"], drawn([scaffold("benzimidazole")], at("N1"), at("C2", "C4", "C5"))],
    ["benzoxazolyl", "苯并噁唑基（2-/4- 至 7-位）", ["benzoxazolyl"], drawn([scaffold("benzoxazole")], at("C2"), at("C4", "C5", "C6", "C7"))],
    ["benzothiazolyl", "苯并噻唑基（2-/4- 至 7-位）", ["benzothiazolyl"], drawn([scaffold("benzothiazole")], at("C2"), at("C4", "C5", "C6", "C7"))],
    ["carbazol-9-yl", "咔唑-9-基", ["carbazol-9-yl", "N-carbazolyl", "Cz"], drawn([scaffold("carbazole")], at("N9"))],
    ["9-phenylcarbazol-3-yl", "9-苯基咔唑-3-基", ["9-phenylcarbazol-3-yl"], drawn([scaffold("carbazole"), phenylOn("N9")], at("C3"))],
    ["dibenzofuranyl", "二苯并呋喃基（1- 至 4-位）", ["dibenzofuranyl", "DBF"], drawn([scaffold("dibenzofuran")], at("C1"), at("C2", "C3", "C4"))],
    ["dibenzothienyl", "二苯并噻吩基（1- 至 4-位）", ["dibenzothienyl", "dibenzothiophenyl", "DBT"], drawn([scaffold("dibenzothiophene")], at("C1"), at("C2", "C3", "C4"))],
    ["phenoxazin-10-yl", "吩噁嗪-10-基", ["phenoxazin-10-yl"], drawn([scaffold("phenoxazine")], at("N10"))],
    ["phenothiazin-10-yl", "吩噻嗪-10-基", ["phenothiazin-10-yl"], drawn([scaffold("phenothiazine")], at("N10"))],
  ])
