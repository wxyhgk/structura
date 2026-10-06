import { emptyDrawing } from "@structura/core"
import { atomHydrogens } from "@structura/core/formula"
import { sizeUnitOf } from "@structura/core/markush"
import { neighbors } from "@structura/core/molecule"
import { applyOps, type Op } from "@structura/core/ops"
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

/** Most substituents put on one representative: enough to show the idea, without the count running away. */
const MOST_CARRIED = 2

/** Every way of choosing `count` groups from `groups`, repeats allowed, order ignored: Cl,Cl · Cl,F · F,F. */
function multisets(groups: readonly string[], count: number, from = 0): string[][] {
  if (count === 0) return [[]]
  return groups.slice(from).flatMap((group, at) => multisets(groups, count - 1, from + at).map((rest) => [group, ...rest]))
}

/**
 * A member carrying substituents, drawn out: the member (Ph) on a "*", with each group put
 * on the atoms farthest from the "*" that still have a hydrogen (para first for phenyl), as
 * a typical example of "substituted with …". Null when the member has no such room.
 */
function withGroups(member: string, groups: readonly string[]): Choice | null {
  const built = applyOps(emptyDrawing(), [
    { op: "add_atom", el: "C", as: "star" },
    { op: "label", atom: "star", text: "*" },
    { op: "add_atom", el: "C", to: "star", as: "head" },
    { op: "label", atom: "head", text: member },
  ])
  if (!built.ok) return null
  const mol = built.drawing.molecule
  const star = built.names.star
  // Graph distance from the "*", for the farthest free positions.
  const distance = new Map([[star, 0]])
  for (const queue = [star]; queue.length > 0; ) {
    const at = queue.shift()!
    for (const next of neighbors(mol, at)) {
      if (distance.has(next.id)) continue
      distance.set(next.id, distance.get(at)! + 1)
      queue.push(next.id)
    }
  }
  const room = mol.atoms
    .filter((atom) => atom.id !== star && atomHydrogens(mol, atom.id).h > 0)
    .sort((a, b) => distance.get(b.id)! - distance.get(a.id)! || a.id - b.id)
  if (room.length < groups.length) return null
  const ops: Op[] = groups.flatMap((group, index): Op[] => [
    { op: "add_atom", el: "C", to: room[index].id, as: `g${index}` },
    { op: "label", atom: `g${index}`, text: group },
  ])
  const done = applyOps(built.drawing, ops)
  if (!done.ok) return null
  return { kind: "fragment", molecule: done.drawing.molecule, name: `${member}（${groups.join("、")}）` }
}

/** The representatives that fit a class alternative: inside its size range (in its unit) and its substitution. */
export function representativesOf(alternative: Extract<Alternative, { kind: "class" }>): Choice[] {
  const { min, max, substituted, substituents } = alternative
  const unit = sizeUnitOf(alternative)
  const sized = REPRESENTATIVES[alternative.class].filter((item) => {
    const size = unit === "carbons" ? item.carbons : item.members
    if (size == null) return min == null && max == null
    return (min == null || size >= min) && (max == null || size <= max)
  })
  if (!substituents) return sized.filter((item) => substituted == null || item.substituted === substituted).map((item) => item.choice)
  // With its substituents named, the class is shown by its plain members (unless they must
  // carry something) and by those members carrying 1, 2… of the named groups.
  const plainOnes = sized.flatMap((item) => (!item.substituted && item.choice.kind === "label" ? [item.choice.text] : []))
  const bare: Choice[] = substituents.min === 0 && substituted !== true ? plainOnes.map((text) => ({ kind: "label", text })) : []
  const first = Math.max(substituents.min, 1)
  const counts = Array.from({ length: Math.max(0, Math.min(substituents.max, MOST_CARRIED) - first + 1) }, (_, at) => first + at)
  const carried = plainOnes.flatMap((text) => counts.flatMap((count) => multisets(substituents.from, count).flatMap((groups) => withGroups(text, groups) ?? [])))
  return [...bare, ...carried]
}
