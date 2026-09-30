import { SINGLE } from "../constants.ts"
import { angleTo, pointFrom } from "../geometry.ts"
import { addBond, atomById, attachRingAt, bondLengthAt, componentOf, moveAtoms, relax, setElement } from "../molecule.ts"
import type { Molecule } from "../types.ts"

/**
 * Divalent pieces that join two atoms: "L is a single bond or a substituted or unsubstituted
 * (C6–C30)arylene". Each is a chain of benzene rings entered at the ipso atom and left at
 * `exit` (3 para, 2 meta), with any ring atoms swapped for another element.
 */
type Bridge = { rings: Array<{ exit: number; swap?: Record<number, string> }>; size: number }

export const BRIDGES = {
  "p-phenylene": { rings: [{ exit: 3 }], size: 6 },
  "m-phenylene": { rings: [{ exit: 2 }], size: 6 },
  "4,4'-biphenylene": { rings: [{ exit: 3 }, { exit: 3 }], size: 12 },
  "2,5-pyridinediyl": { rings: [{ exit: 3, swap: { 5: "N" } }], size: 6 },
} satisfies Record<string, Bridge>

export type BridgeName = keyof typeof BRIDGES

/**
 * Joins `a` and `b` (not yet bonded) through a bridge, or directly for "bond". The smaller
 * of the two pieces the bridge will join moves: it is carried over to sit one bond beyond
 * the bridge's far end, in line with it, then tidied; the other stays exactly where it is.
 * `toward` is where the old link lay, which the bridge grows toward from the fixed side.
 */
export function bridge(mol: Molecule, a: number, b: number, piece: BridgeName | "bond", toward: { x: number; y: number }): Molecule {
  let [fixed, moving] = [a, b]
  const sideOf = (id: number) => componentOf(mol, id)
  if (sideOf(a).length < sideOf(b).length) [fixed, moving] = [b, a]
  const movingSide = sideOf(moving)
  const length = bondLengthAt(mol, fixed)
  let next = mol
  let end = fixed
  let direction = angleTo(atomById(mol, fixed)!, toward)
  if (piece !== "bond") {
    for (const ring of (BRIDGES[piece] as Bridge).rings) {
      const grown = attachRingAt(next, end, "benzene", direction)
      next = grown.mol
      for (const [index, el] of Object.entries(ring.swap ?? {})) next = setElement(next, [grown.ids[Number(index)]], el)
      const ipso = atomById(next, grown.ipso)!
      end = grown.ids[ring.exit]
      direction = angleTo(ipso, atomById(next, end)!)
    }
  }
  // Carry the moving piece so the atom that joins sits one bond out from the bridge's end.
  const from = atomById(next, moving)!
  const spot = pointFrom(atomById(next, end)!, direction, length)
  next = moveAtoms(next, movingSide, spot.x - from.x, spot.y - from.y)
  next = addBond(next, end, moving, SINGLE)?.mol ?? next
  const rest = movingSide.filter((id) => id !== moving)
  return rest.length > 0 ? relax(next, { atoms: rest, locked: [moving] }) : next
}
