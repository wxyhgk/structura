import { angleTo, norm, pointFrom, pointInPolygon, signedDelta } from "../geometry.ts"
import type { Atom, Molecule } from "../types.ts"
import { ringMembership } from "./cycles.ts"
import { atomById, neighbors } from "./graph.ts"

type Gap = { start: number; gap: number }

/** The empty sectors between bonds, as sorted directions go round: where each starts and how wide. */
function gaps(directions: number[]): Gap[] {
  const angles = [...directions].sort((a, b) => a - b)
  return angles.map((start, index) => {
    const end = angles[(index + 1) % angles.length] + (index === angles.length - 1 ? Math.PI * 2 : 0)
    return { start, gap: end - start }
  })
}

/** Whether a sector opens into one of the atom's rings, as the inside angle of a ring does. */
function insideRing(mol: Molecule, atom: Atom, { start, gap }: Gap): boolean {
  const probe = pointFrom(atom, start + gap / 2, 1)
  const at = new Map(mol.atoms.map((item) => [item.id, item]))
  return ringMembership(mol).rings.some((ring) => ring.includes(atom.id) && pointInPolygon(probe, ring.map((id) => at.get(id)!)))
}

/**
 * The widest empty sector around a branched atom that does not open into one of its rings,
 * so a ring-fusion atom, whose three sectors may be equal, still sprouts outward; the
 * widest of all when every sector is inside a ring.
 */
function widestGap(mol: Molecule, atom: Atom, directions: number[]): Gap {
  const all = gaps(directions)
  const widest = (list: Gap[]) => list.reduce((best, item) => (item.gap > best.gap ? item : best), { start: 0, gap: -1 })
  const open = (ringMembership(mol).count.get(atom.id) ?? 0) > 0 ? all.filter((item) => !insideRing(mol, atom, item)) : all
  return widest(open.length > 0 ? open : all)
}

/**
 * Where the next bond from an atom goes. A lone atom points right; an end atom continues
 * the zigzag; a branched atom fills the widest gap between its bonds.
 */
export function sproutAngle(mol: Molecule, atomId: number): number {
  const atom = atomById(mol, atomId)
  if (!atom) return 0
  const bonded = neighbors(mol, atomId)
  if (bonded.length === 0) return 0
  if (bonded.length === 1) {
    const parent = bonded[0]
    const incoming = angleTo(parent, atom)
    const earlier = neighbors(mol, parent.id).filter((item) => item.id !== atomId)
    if (earlier.length === 0) return norm(incoming + Math.PI / 3)
    const previous = angleTo(earlier[0], parent)
    const lastTurn = signedDelta(previous, incoming)
    return norm(incoming - lastTurn)
  }
  const { start, gap } = widestGap(mol, atom, bonded.map((item) => angleTo(atom, item)))
  return norm(start + gap / 2)
}

/** Continue straight through a singly bonded atom, away from its neighbor. */
export function outwardAngle(mol: Molecule, atomId: number): number {
  const atom = atomById(mol, atomId)
  const bonded = neighbors(mol, atomId)
  if (!atom || bonded.length !== 1) return sproutAngle(mol, atomId)
  return angleTo(bonded[0], atom)
}

/** Two bonds added at once (a fork, a wedge and hash pair): spread across the widest gap. */
export function branchAngles(mol: Molecule, id: number): [number, number] {
  const atom = atomById(mol, id)
  const bonded = neighbors(mol, id)
  if (!atom || bonded.length === 0) return [Math.PI / 3, -Math.PI / 3]
  if (bonded.length === 1) {
    const away = angleTo(atom, bonded[0])
    return [away + (2 * Math.PI) / 3, away - (2 * Math.PI) / 3]
  }
  const { start, gap } = widestGap(mol, atom, bonded.map((item) => angleTo(atom, item)))
  const spread = Math.min(Math.PI / 3, Math.max(0.35, (gap - 0.5) / 2))
  const mid = start + gap / 2
  return [mid - spread, mid + spread]
}
