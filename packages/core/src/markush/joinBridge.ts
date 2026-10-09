import { SINGLE } from "../constants.ts"
import { angleTo, pointFrom } from "../geometry.ts"
import { addBond, atomById, componentOf, setElement } from "../molecule/graph.ts"
import { bondLengthAt } from "../molecule/measure.ts"
import { relax } from "../molecule/relax.ts"
import { attachRingAt } from "../molecule/rings.ts"
import { moveAtoms } from "../molecule/transform.ts"
import type { Molecule } from "../types.ts"
import type { BridgeName } from "./types.ts"
import { BRIDGES, type Bridge } from "./bridges.ts"

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
