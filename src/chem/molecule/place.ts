import { pointFrom } from "../geometry.ts"
import type { BondStyle, Molecule } from "../types.ts"
import { addAtom, addBond, atomById } from "./graph.ts"
import { bondLengthAt } from "./measure.ts"
import { nearestAtom } from "./snap.ts"

/** Adds one atom bonded to `atomId`, one local bond length away along `angle`. */
export function sproutAt(
  mol: Molecule,
  atomId: number,
  angle: number,
  style: BondStyle,
  el = "C",
  charge = 0,
  /**
   * How close an existing atom must be to be joined instead of adding a new one. 0, the
   * default, always adds: only pointer gestures join, so recipes and agents never close a
   * ring by accident.
   */
  snap = 0,
): { mol: Molecule; id: number } {
  const atom = atomById(mol, atomId)
  if (!atom) return { mol, id: atomId }
  const point = pointFrom(atom, angle, bondLengthAt(mol, atomId))
  const near = snap > 0 ? nearestAtom(mol, point, snap, atomId) : null
  if (near) {
    const bonded = addBond(mol, atomId, near.id, style)
    return { mol: bonded?.mol ?? mol, id: near.id }
  }
  const added = addAtom(mol, el, point.x, point.y, charge)
  const bonded = addBond(added.mol, atomId, added.id, style)
  return { mol: bonded?.mol ?? added.mol, id: added.id }
}
