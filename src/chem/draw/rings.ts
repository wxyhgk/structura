import { atomById, cycleAround } from "../molecule.ts"
import type { Bond, Molecule, Point } from "../types.ts"

export function inwardPoint(mol: Molecule, bond: Bond): Point | null {
  if (bond.order < 2) return null
  const cycle = cycleAround(mol, bond)
  if (!cycle) return null
  let x = 0
  let y = 0
  for (const id of cycle) {
    const atom = atomById(mol, id)
    if (!atom) return null
    x += atom.x
    y += atom.y
  }
  return { x: x / cycle.length, y: y / cycle.length }
}
