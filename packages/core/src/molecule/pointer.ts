import { BOND_LENGTH, SINGLE } from "../constants.ts"
import { pointFrom } from "../geometry.ts"
import type { BondStyle, Molecule, Point } from "../types.ts"
import { sproutAngle } from "./angles.ts"
import { addAtom, addBond, setElement } from "./graph.ts"
import { bondLengthAt } from "./measure.ts"
import { sproutAt } from "./place.ts"
import { nearestAtom } from "./snap.ts"

/*
 * What the drawing tools do with the pointer, also reached by the draw_* ops. These join
 * existing atoms the pointer lands on; nothing else in the layout does.
 */

/** Clicking an atom, and a clicked bond's tip landing on one, in pixels at the default bond length. */
export const ATOM_HIT = 12

/** Dragging a bond end onto an existing atom. */
export const SNAP_ATOM = 16

/** The chain tool joining a vertex to an existing atom. */
export const SNAP_CHAIN = 10

/**
 * A pointer snap radius, given in pixels at the default bond length, scaled to the
 * drawing so a zoomed-out or scaled-up structure snaps just as readily.
 */
function snapRadius(mol: Molecule, pixels: number, atomId?: number): number {
  return (pixels * bondLengthAt(mol, atomId)) / BOND_LENGTH
}

export function createBondAt(mol: Molecule, origin: Point, style: BondStyle, el = "C"): Molecule {
  const end = pointFrom(origin, 0, bondLengthAt(mol))
  const first = addAtom(mol, el, origin.x, origin.y)
  const second = addAtom(first.mol, el, end.x, end.y)
  return addBond(second.mol, first.id, second.id, style)?.mol ?? second.mol
}

/** A bond drawn by clicking an atom: the tip joins an atom it lands on, as the pointer tools do. */
export function sprout(mol: Molecule, atomId: number, style: BondStyle, el = "C"): Molecule {
  return sproutAt(mol, atomId, sproutAngle(mol, atomId), style, el, 0, snapRadius(mol, ATOM_HIT, atomId)).mol
}

export function connectPoints(
  mol: Molecule,
  fromId: number | null,
  origin: Point,
  end: Point,
  style: BondStyle,
  el = "C",
): Molecule {
  const target = nearestAtom(mol, end, snapRadius(mol, SNAP_ATOM), fromId ?? undefined)
  if (fromId == null) {
    const startNear = nearestAtom(mol, origin, snapRadius(mol, ATOM_HIT))
    const start = startNear ? { mol, id: startNear.id } : addAtom(mol, el, origin.x, origin.y)
    if (target && target.id !== start.id) {
      return addBond(start.mol, start.id, target.id, style)?.mol ?? start.mol
    }
    const added = addAtom(start.mol, el, end.x, end.y)
    return addBond(added.mol, start.id, added.id, style)?.mol ?? added.mol
  }
  if (target) return addBond(mol, fromId, target.id, style)?.mol ?? mol
  const added = addAtom(mol, el, end.x, end.y)
  return addBond(added.mol, fromId, added.id, style)?.mol ?? added.mol
}

export function placeAtom(mol: Molecule, el: string, point: Point): Molecule {
  const near = nearestAtom(mol, point, snapRadius(mol, ATOM_HIT))
  if (near) return setElement(mol, [near.id], el)
  return addAtom(mol, el, point.x, point.y).mol
}

export function chainPoints(origin: Point, axis: number, count: number, length = BOND_LENGTH): Point[] {
  const points = [origin]
  let cursor = origin
  for (let index = 0; index < count; index++) {
    const angle = axis + (index % 2 === 0 ? 1 : -1) * (Math.PI / 6)
    cursor = pointFrom(cursor, angle, length)
    points.push(cursor)
  }
  return points
}

export function commitChain(mol: Molecule, points: Point[], fromId: number | null): Molecule {
  let next = mol
  let previous = fromId
  const start = fromId == null ? 0 : 1
  const radius = snapRadius(mol, SNAP_CHAIN)
  for (let index = start; index < points.length; index++) {
    const near = nearestAtom(next, points[index], radius, previous ?? undefined)
    let id: number
    if (near && near.id !== previous) {
      id = near.id
    } else {
      const added = addAtom(next, "C", points[index].x, points[index].y)
      next = added.mol
      id = added.id
    }
    if (previous != null) {
      const bonded = addBond(next, previous, id, SINGLE, false)
      if (bonded) next = bonded.mol
    }
    previous = id
  }
  return next
}
