import type { Alternative, BridgeName, Choice, GroupClass } from "@structura/core/types"

/**
 * A typical member of a class, for generating example compounds from a claim that names
 * only classes. `size` is counted the way the class counts it (carbons, or ring members for
 * heteroaryl and heterocycloalkyl); `substituted` says whether it is the plain group
 * (SiH3, NH2) or one carrying substituents (SiMe3, NMe2, CF3).
 */
type Representative = { choice: Choice; size: number; substituted: boolean }

const plain = (text: string, size: number): Representative => ({ choice: { kind: "label", text }, size, substituted: false })
const carrying = (text: string, size: number): Representative => ({ choice: { kind: "label", text }, size, substituted: true })
const bridge = (name: BridgeName, size: number): Representative => ({ choice: { kind: "bridge", name }, size, substituted: false })

export const REPRESENTATIVES: Record<GroupClass, Representative[]> = {
  alkyl: [plain("Me", 1), plain("Et", 2), plain("iPr", 3), plain("tBu", 4), carrying("CF3", 1)],
  alkenyl: [plain("Vinyl", 2), plain("Allyl", 3)],
  alkynyl: [plain("Ethynyl", 2), plain("Propargyl", 3)],
  cycloalkyl: [plain("cPr", 3), plain("Cy", 6)],
  heterocycloalkyl: [plain("THP", 6)],
  aryl: [plain("Ph", 6), plain("1-Naphthyl", 10), plain("2-Naphthyl", 10), plain("4-Biphenylyl", 12), carrying("Tol", 7), carrying("Mes", 9)],
  heteroaryl: [plain("2-Pyridyl", 6), plain("2-Furyl", 5), plain("2-Thienyl", 5), plain("2-Pyrimidinyl", 6), plain("3-Indolyl", 9)],
  alkoxy: [plain("OMe", 1), plain("OEt", 2)],
  aryloxy: [plain("OPh", 6)],
  // An element label is the bare group with its hydrogens: Si is SiH3, N is NH2.
  silyl: [plain("Si", 0), carrying("TMS", 3), carrying("SiPh3", 18)],
  amino: [plain("N", 0), carrying("NMe2", 2), carrying("NHPh", 6)],
  // Divalent: joining the two atoms a linker sits between.
  arylene: [bridge("p-phenylene", 6), bridge("m-phenylene", 6), bridge("4,4'-biphenylene", 12)],
  heteroarylene: [bridge("2,5-pyridinediyl", 6)],
}

/** The representatives that fit a class alternative: inside its size range and its substitution. */
export function representativesOf(alternative: Extract<Alternative, { kind: "class" }>): Choice[] {
  const { min, max, substituted } = alternative
  return REPRESENTATIVES[alternative.class]
    .filter((item) => (min == null || item.size >= min) && (max == null || item.size <= max))
    .filter((item) => substituted == null || item.substituted === substituted)
    .map((item) => item.choice)
}
