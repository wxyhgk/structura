import { RING_SIZE } from "../constants.ts"
import { dist, sideOfLine } from "../geometry.ts"
import type { Bond, Molecule, Point, RingKind } from "../types.ts"
import { atomById, bondBetween, bondById, bondOrderSum, cycleAround } from "./graph.ts"
import { buildRing, ringOnBond } from "./rings.ts"

const COINCIDENT = 0.8

/**
 * Vertices that land on an existing atom are reused. That is how a third
 * ring closes across the bay of naphthalene: the new hexagon shares the
 * bridgehead and both neighboring carbons, instead of giving the bridgehead
 * another bond.
 */
function planFusion(
  mol: Molecule,
  bond: Bond,
  kind: RingKind,
  side: 1 | -1,
): { points: Point[]; reuse: Array<number | null> } | null {
  const a = atomById(mol, bond.a)
  const b = atomById(mol, bond.b)
  if (!a || !b) return null
  const points = ringOnBond(a, b, RING_SIZE[kind], openSide(mol, bond, side))
  const reuse: Array<number | null> = points.map((point, index) => {
    if (index === 0) return bond.a
    if (index === 1) return bond.b
    let best: number | null = null
    let bestDistance = COINCIDENT
    for (const atom of mol.atoms) {
      const distance = dist(point, atom)
      if (distance <= bestDistance) {
        best = atom.id
        bestDistance = distance
      }
    }
    return best
  })
  if (new Set(reuse.filter((id) => id != null)).size !== reuse.filter((id) => id != null).length) return null
  const extra = new Map<number, number>()
  let adds = false
  for (let index = 0; index < reuse.length; index++) {
    const left = reuse[index]
    const right = reuse[(index + 1) % reuse.length]
    if (left != null && right != null && bondBetween(mol, left, right)) continue
    adds = true
    if (left != null) extra.set(left, (extra.get(left) ?? 0) + 1)
    if (right != null) extra.set(right, (extra.get(right) ?? 0) + 1)
  }
  if (!adds) return null
  for (const [id, count] of extra) {
    const atom = atomById(mol, id)
    if (!atom) return null
    const room = atom.el === "C" ? 4 - Math.abs(atom.charge) : 8
    if (bondOrderSum(mol, id) + count > room) return null
  }
  return { points, reuse }
}

/** Whether a ring of this kind can be fused onto the bond without overfilling an atom. */
export function canFuse(mol: Molecule, bond: Bond, kind: RingKind): boolean {
  return planFusion(mol, bond, kind, 1) != null
}

/** Side of a ring bond that does not already contain the ring. A chain bond keeps the requested side. */
export function openSide(mol: Molecule, bond: Bond, preferred: 1 | -1): 1 | -1 {
  const cycle = cycleAround(mol, bond)
  const a = atomById(mol, bond.a)
  const b = atomById(mol, bond.b)
  if (!cycle || !a || !b) return preferred
  let x = 0
  let y = 0
  let count = 0
  for (const id of cycle) {
    const atom = atomById(mol, id)
    if (!atom) continue
    x += atom.x
    y += atom.y
    count += 1
  }
  if (count === 0) return preferred
  const occupied = sideOfLine(a, b, { x: x / count, y: y / count })
  return occupied === 1 ? -1 : 1
}

export function fuseRing(mol: Molecule, bondId: number, kind: RingKind, side: 1 | -1): Molecule {
  return fuseRingAt(mol, bondId, kind, side).mol
}

export function fuseRingAt(
  mol: Molecule,
  bondId: number,
  kind: RingKind,
  side: 1 | -1,
): { mol: Molecule; far: number } {
  const bond = bondById(mol, bondId)
  if (!bond) return { mol, far: 0 }
  const a = atomById(mol, bond.a)
  const b = atomById(mol, bond.b)
  if (!a || !b) return { mol, far: bond.a }
  const plan = planFusion(mol, bond, kind, side)
  if (!plan) return { mol, far: bond.a }
  const built = buildRing(mol, plan.points, kind, plan.reuse)
  const far = built.ids[Math.floor(RING_SIZE[kind] / 2)] ?? a.id
  return { mol: built.mol, far }
}
