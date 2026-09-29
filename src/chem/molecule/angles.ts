import { angleTo, norm, signedDelta } from "../geometry.ts"
import type { Molecule } from "../types.ts"
import { atomById, neighbors } from "./graph.ts"

/** The widest empty sector between bonds, as sorted directions go round: where it starts and how wide. */
function widestGap(directions: number[]): { start: number; gap: number } {
  const angles = [...directions].sort((a, b) => a - b)
  let best = { start: 0, gap: -1 }
  for (let index = 0; index < angles.length; index++) {
    const start = angles[index]
    const end = angles[(index + 1) % angles.length] + (index === angles.length - 1 ? Math.PI * 2 : 0)
    if (end - start > best.gap) best = { start, gap: end - start }
  }
  return best
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
  const { start, gap } = widestGap(bonded.map((item) => angleTo(atom, item)))
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
  const { start, gap } = widestGap(bonded.map((item) => angleTo(atom, item)))
  const spread = Math.min(Math.PI / 3, Math.max(0.35, (gap - 0.5) / 2))
  const mid = start + gap / 2
  return [mid - spread, mid + spread]
}
