// The scaffold templates: ring systems as patents and papers draw them, numbered the IUPAC way.
// Atoms are named by locant (C1, N9, C4a); the letter in front is the element. Each ring is
// listed round in order; a ring after the first shares a bond with an earlier one. `doubles`
// is one Kekulé structure; `aromatic` names the rings whose bonds are aromatic (so a later
// fusion can redo the alternation). `order` gives the numbering when the locants' natural
// order is not the way round the outside (anthracene); it decides the bond letters a, b, c…

export type ScaffoldSpec = {
  name: string
  /** The Chinese name, as the template panel shows it. */
  zh: string
  group: "单环" | "双环" | "三环"
  rings: string[][]
  doubles: Array<[string, string]>
  /** Indexes into `rings`; all rings when left out. */
  aromatic?: number[]
  order?: string[]
}

const six = (a: string, b: string, c: string, d: string, e: string, f: string) => [a, b, c, d, e, f]

/** A benzene-type ring and an azole fused, numbered like indole: X1, Y2, Z3, 3a, 4–7, 7a. */
function benzoFive(name: string, zh: string, x1: string, y2 = "C2", z3 = "C3"): ScaffoldSpec {
  return {
    name,
    zh,
    group: "双环",
    rings: [
      [x1, y2, z3, "C3a", "C7a"],
      ["C3a", "C4", "C5", "C6", "C7", "C7a"],
    ],
    doubles: [
      [y2, z3],
      ["C3a", "C7a"],
      ["C4", "C5"],
      ["C6", "C7"],
    ],
  }
}

/** Two benzene rings either side of a five-membered ring through 4a–9a (fluorene, carbazole). */
function fluoreneLike(name: string, zh: string, nine: string): ScaffoldSpec {
  return {
    name,
    zh,
    group: "三环",
    rings: [six("C1", "C2", "C3", "C4", "C4a", "C9a"), ["C4a", "C4b", "C8a", nine, "C9a"], six("C4b", "C5", "C6", "C7", "C8", "C8a")],
    doubles: [
      ["C1", "C2"],
      ["C3", "C4"],
      ["C4a", "C9a"],
      ["C4b", "C8a"],
      ["C5", "C6"],
      ["C7", "C8"],
    ],
    aromatic: [0, 2],
  }
}

/** Two benzene rings either side of a five-membered ring with X5 (dibenzofuran, dibenzothiophene). */
function dibenzoFive(name: string, zh: string, five: string): ScaffoldSpec {
  return {
    name,
    zh,
    group: "三环",
    rings: [six("C1", "C2", "C3", "C4", "C4a", "C9b"), ["C4a", five, "C5a", "C9a", "C9b"], six("C5a", "C6", "C7", "C8", "C9", "C9a")],
    doubles: [
      ["C1", "C2"],
      ["C3", "C4"],
      ["C4a", "C9b"],
      ["C5a", "C9a"],
      ["C6", "C7"],
      ["C8", "C9"],
    ],
    aromatic: [0, 2],
  }
}

/** Two benzene rings either side of a six-membered ring with X5 and N10 (phenoxazine, phenothiazine). */
function phenoSix(name: string, zh: string, five: string): ScaffoldSpec {
  return {
    name,
    zh,
    group: "三环",
    rings: [six("C1", "C2", "C3", "C4", "C4a", "C10a"), six("C4a", five, "C5a", "C9a", "N10", "C10a"), six("C5a", "C6", "C7", "C8", "C9", "C9a")],
    doubles: [
      ["C1", "C2"],
      ["C3", "C4"],
      ["C4a", "C10a"],
      ["C5a", "C9a"],
      ["C6", "C7"],
      ["C8", "C9"],
    ],
    aromatic: [0, 2],
  }
}

/** A six-membered aromatic ring numbered 1–6 from its first atom. */
function sixRing(name: string, zh: string, atoms: string[]): ScaffoldSpec {
  return { name, zh, group: "单环", rings: [atoms], doubles: [[atoms[0], atoms[1]], [atoms[2], atoms[3]], [atoms[4], atoms[5]]] }
}

/** A five-membered aromatic ring, heteroatom at 1. */
function fiveRing(name: string, zh: string, one: string): ScaffoldSpec {
  return { name, zh, group: "单环", rings: [[one, "C2", "C3", "C4", "C5"]], doubles: [["C2", "C3"], ["C4", "C5"]] }
}

export const SCAFFOLD_SPECS: ScaffoldSpec[] = [
  sixRing("benzene", "苯", ["C1", "C2", "C3", "C4", "C5", "C6"]),
  sixRing("pyridine", "吡啶", ["N1", "C2", "C3", "C4", "C5", "C6"]),
  sixRing("pyrimidine", "嘧啶", ["N1", "C2", "N3", "C4", "C5", "C6"]),
  sixRing("pyrazine", "吡嗪", ["N1", "C2", "C3", "N4", "C5", "C6"]),
  sixRing("triazine", "1,3,5-三嗪", ["N1", "C2", "N3", "C4", "N5", "C6"]),
  fiveRing("furan", "呋喃", "O1"),
  fiveRing("thiophene", "噻吩", "S1"),
  fiveRing("pyrrole", "吡咯", "N1"),
  {
    name: "naphthalene",
    zh: "萘",
    group: "双环",
    rings: [six("C1", "C2", "C3", "C4", "C4a", "C8a"), six("C4a", "C5", "C6", "C7", "C8", "C8a")],
    doubles: [
      ["C1", "C2"],
      ["C3", "C4"],
      ["C4a", "C8a"],
      ["C5", "C6"],
      ["C7", "C8"],
    ],
  },
  {
    name: "quinoline",
    zh: "喹啉",
    group: "双环",
    rings: [six("N1", "C2", "C3", "C4", "C4a", "C8a"), six("C4a", "C5", "C6", "C7", "C8", "C8a")],
    doubles: [
      ["N1", "C2"],
      ["C3", "C4"],
      ["C4a", "C8a"],
      ["C5", "C6"],
      ["C7", "C8"],
    ],
  },
  {
    name: "isoquinoline",
    zh: "异喹啉",
    group: "双环",
    rings: [six("C1", "N2", "C3", "C4", "C4a", "C8a"), six("C4a", "C5", "C6", "C7", "C8", "C8a")],
    doubles: [
      ["C1", "N2"],
      ["C3", "C4"],
      ["C4a", "C8a"],
      ["C5", "C6"],
      ["C7", "C8"],
    ],
  },
  benzoFive("indole", "吲哚", "N1"),
  benzoFive("benzofuran", "苯并呋喃", "O1"),
  benzoFive("benzothiophene", "苯并噻吩", "S1"),
  benzoFive("benzimidazole", "苯并咪唑", "N1", "C2", "N3"),
  benzoFive("benzoxazole", "苯并噁唑", "O1", "C2", "N3"),
  benzoFive("benzothiazole", "苯并噻唑", "S1", "C2", "N3"),
  {
    name: "anthracene",
    zh: "蒽",
    group: "三环",
    rings: [six("C1", "C2", "C3", "C4", "C4a", "C9a"), six("C4a", "C10", "C10a", "C8a", "C9", "C9a"), six("C10a", "C5", "C6", "C7", "C8", "C8a")],
    doubles: [
      ["C1", "C2"],
      ["C3", "C4"],
      ["C4a", "C9a"],
      ["C10", "C10a"],
      ["C8a", "C9"],
      ["C5", "C6"],
      ["C7", "C8"],
    ],
    order: ["C1", "C2", "C3", "C4", "C4a", "C10", "C10a", "C5", "C6", "C7", "C8", "C8a", "C9", "C9a"],
  },
  {
    name: "phenanthrene",
    zh: "菲",
    group: "三环",
    rings: [six("C1", "C2", "C3", "C4", "C4a", "C10a"), six("C4a", "C4b", "C8a", "C9", "C10", "C10a"), six("C4b", "C5", "C6", "C7", "C8", "C8a")],
    doubles: [
      ["C1", "C2"],
      ["C3", "C4"],
      ["C4a", "C10a"],
      ["C4b", "C8a"],
      ["C9", "C10"],
      ["C5", "C6"],
      ["C7", "C8"],
    ],
  },
  fluoreneLike("fluorene", "芴", "C9"),
  fluoreneLike("carbazole", "咔唑", "N9"),
  dibenzoFive("dibenzofuran", "二苯并呋喃", "O5"),
  dibenzoFive("dibenzothiophene", "二苯并噻吩", "S5"),
  phenoSix("phenoxazine", "吩噁嗪", "O5"),
  phenoSix("phenothiazine", "吩噻嗪", "S5"),
]
