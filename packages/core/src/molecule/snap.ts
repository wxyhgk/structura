import { dist } from "../geometry.ts"
import type { Atom, Bond, Molecule, Point } from "../types.ts"
import { atomById } from "./graph.ts"

export function nearestAtom(
  mol: Molecule,
  point: Point,
  radius: number,
  ignore?: number,
): Atom | null {
  let best: Atom | null = null
  let bestDistance = radius
  for (const atom of mol.atoms) {
    if (atom.id === ignore) continue
    const distance = dist(atom, point)
    if (distance <= bestDistance) {
      best = atom
      bestDistance = distance
    }
  }
  return best
}

export function nearestBond(mol: Molecule, point: Point, radius: number): Bond | null {
  let best: Bond | null = null
  let bestDistance = radius
  for (const bond of mol.bonds) {
    const a = atomById(mol, bond.a)
    const b = atomById(mol, bond.b)
    if (!a || !b) continue
    const distance = distanceToBond(point, a, b)
    if (distance <= bestDistance) {
      best = bond
      bestDistance = distance
    }
  }
  return best
}

function distanceToBond(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return dist(point, a)
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq))
  return dist(point, { x: a.x + t * dx, y: a.y + t * dy })
}
