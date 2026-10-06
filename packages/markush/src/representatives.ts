import { sizeUnitOf } from "@structura/core/markush"
import type { Alternative, BridgeName, Choice, GroupClass } from "@structura/core/types"

/**
 * A typical member of a class, for generating example compounds from a claim that names
 * only classes. Its size both ways: `carbons`, and `members` (ring atoms of its ring system,
 * left out where "membered" means nothing, as for an alkyl or a biphenylyl); `substituted`
 * says whether it is the plain group (SiH3, NH2) or one carrying substituents (SiMe3, CF3).
 */
type Representative = { choice: Choice; carbons: number; members?: number; substituted: boolean }

const plain = (text: string, carbons: number, members?: number): Representative => ({ choice: { kind: "label", text }, carbons, members, substituted: false })
const carrying = (text: string, carbons: number, members?: number): Representative => ({ choice: { kind: "label", text }, carbons, members, substituted: true })
const bridge = (name: BridgeName, carbons: number, members?: number): Representative => ({ choice: { kind: "bridge", name }, carbons, members, substituted: false })

export const REPRESENTATIVES: Record<GroupClass, Representative[]> = {
  alkyl: [plain("Me", 1), plain("Et", 2), plain("iPr", 3), plain("tBu", 4), carrying("CF3", 1)],
  alkenyl: [plain("Vinyl", 2), plain("Allyl", 3)],
  alkynyl: [plain("Ethynyl", 2), plain("Propargyl", 3)],
  cycloalkyl: [plain("cPr", 3, 3), plain("Cy", 6, 6)],
  heterocycloalkyl: [plain("THP", 5, 6)],
  aryl: [plain("Ph", 6, 6), plain("1-Naphthyl", 10, 10), plain("2-Naphthyl", 10, 10), plain("4-Biphenylyl", 12), carrying("Tol", 7, 6), carrying("Mes", 9, 6)],
  heteroaryl: [plain("2-Pyridyl", 5, 6), plain("2-Furyl", 4, 5), plain("2-Thienyl", 4, 5), plain("2-Pyrimidinyl", 4, 6), plain("3-Indolyl", 8, 9)],
  alkoxy: [plain("OMe", 1), plain("OEt", 2)],
  aryloxy: [plain("OPh", 6, 6)],
  // An element label is the bare group with its hydrogens: Si is SiH3, N is NH2.
  silyl: [plain("Si", 0), carrying("TMS", 3), carrying("SiPh3", 18)],
  amino: [plain("N", 0), carrying("NMe2", 2), carrying("NHPh", 6)],
  // Divalent: joining the two atoms a linker sits between.
  arylene: [bridge("p-phenylene", 6, 6), bridge("m-phenylene", 6, 6), bridge("4,4'-biphenylene", 12)],
  heteroarylene: [bridge("2,5-pyridinediyl", 5, 6)],
}

/** The representatives that fit a class alternative: inside its size range (in its unit) and its substitution. */
export function representativesOf(alternative: Extract<Alternative, { kind: "class" }>): Choice[] {
  const { min, max, substituted } = alternative
  const unit = sizeUnitOf(alternative)
  return REPRESENTATIVES[alternative.class]
    .filter((item) => {
      const size = unit === "carbons" ? item.carbons : item.members
      if (size == null) return min == null && max == null
      return (min == null || size >= min) && (max == null || size <= max)
    })
    .filter((item) => substituted == null || item.substituted === substituted)
    .map((item) => item.choice)
}
