import { BOND_LENGTH } from "@structura/core/constants"
import { distToSegment, sideOfLine } from "@structura/core/geometry"
import { atomById, canPlaceFused, openSide } from "@structura/core/molecule"
import type { Bond, Molecule, Point, RingKind } from "@structura/core/types"

// The ring tool over a bond: which bond the pointer means and on which side the ring goes.

/** Nearest bond that can accept a fused ring. Bridgehead atoms are skipped. */
export function fusionTarget(mol: Molecule, point: Point, kind: RingKind, radius: number): Bond | null {
  let best: Bond | null = null
  let bestDistance = radius
  for (const bond of mol.bonds) {
    const a = atomById(mol, bond.a)
    const b = atomById(mol, bond.b)
    if (!a || !b) continue
    const distance = distToSegment(point, a, b)
    // The bond nearest the pointer, never another one that would fit more cleanly: the ring goes
    // where the chemist points, overfilling an atom if it must (shown red). Distance is cheap
    // and rules out almost every bond; only then ask whether a ring fits there at all.
    if (distance <= bestDistance && canPlaceFused(mol, bond, kind)) {
      best = bond
      bestDistance = distance
    }
  }
  return best
}

/** How far from a bond the pointer still counts as fusing a ring of this size. */
export function fuseReach(size: number, length = BOND_LENGTH): number {
  const apothem = length / (2 * Math.tan(Math.PI / size))
  return apothem + 4
}

function fuseSide(mol: Molecule, bond: Bond, point: Point): 1 | -1 {
  const a = atomById(mol, bond.a)
  const b = atomById(mol, bond.b)
  if (!a || !b) return 1
  return sideOfLine(a, b, point)
}

export function fusionSide(mol: Molecule, bond: Bond, point: Point): 1 | -1 {
  return openSide(mol, bond, fuseSide(mol, bond, point))
}
