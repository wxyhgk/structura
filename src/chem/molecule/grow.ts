import { sproutAngle } from "./angles.ts"
import { neighbors } from "./graph.ts"
import { sproutAt } from "./place.ts"
import type { BondStyle, HotTarget, Molecule } from "../types.ts"

export const SINGLE: BondStyle = { order: 1, stereo: "none" }
export const DOUBLE: BondStyle = { order: 2, stereo: "none" }
export const TRIPLE: BondStyle = { order: 3, stereo: "none" }
export const WEDGE: BondStyle = { order: 1, stereo: "up" }
export const HASH: BondStyle = { order: 1, stereo: "down" }

export type HotResult = { mol: Molecule; next: HotTarget }

export function atomNext(mol: Molecule, id: number): HotResult {
  return { mol, next: { type: "atom", id } }
}

export function degree(mol: Molecule, id: number): number {
  return neighbors(mol, id).length
}

export function inRing(mol: Molecule, id: number): boolean {
  const bonded = neighbors(mol, id)
  if (bonded.length < 2) return false
  const goals = new Set(bonded.slice(1).map((atom) => atom.id))
  const queue = [bonded[0].id]
  const seen = new Set<number>([id, bonded[0].id])
  while (queue.length > 0) {
    const current = queue.shift()
    if (current == null) break
    if (goals.has(current)) return true
    for (const next of neighbors(mol, current)) {
      if (seen.has(next.id)) continue
      seen.add(next.id)
      queue.push(next.id)
    }
  }
  return false
}

export function extend(mol: Molecule, id: number, style: BondStyle, el = "C"): HotResult {
  const grown = sproutAt(mol, id, sproutAngle(mol, id), style, el)
  return atomNext(grown.mol, grown.id)
}
