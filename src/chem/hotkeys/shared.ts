import { angleTo } from "../geometry.ts"
import { atomById, neighbors, sproutAngle, sproutAt } from "../molecule.ts"
import type { BondStyle, Molecule } from "../types.ts"

export const SINGLE: BondStyle = { order: 1, stereo: "none" }
export const DOUBLE: BondStyle = { order: 2, stereo: "none" }
export const TRIPLE: BondStyle = { order: 3, stereo: "none" }
export const WEDGE: BondStyle = { order: 1, stereo: "up" }
export const HASH: BondStyle = { order: 1, stereo: "down" }

export type HotTarget = { type: "atom"; id: number } | { type: "bond"; id: number }

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

export function branchAngles(mol: Molecule, id: number): [number, number] {
  const atom = atomById(mol, id)
  const bonded = neighbors(mol, id)
  if (!atom || bonded.length === 0) return [Math.PI / 3, -Math.PI / 3]
  if (bonded.length === 1) {
    const away = angleTo(atom, bonded[0])
    return [away + (2 * Math.PI) / 3, away - (2 * Math.PI) / 3]
  }
  const angles = bonded.map((item) => angleTo(atom, item)).sort((a, b) => a - b)
  let bestGap = -1
  let start = 0
  for (let index = 0; index < angles.length; index++) {
    const from = angles[index]
    const to = angles[(index + 1) % angles.length] + (index === angles.length - 1 ? Math.PI * 2 : 0)
    const gap = to - from
    if (gap > bestGap) {
      bestGap = gap
      start = from
    }
  }
  const spread = Math.min(Math.PI / 3, Math.max(0.35, (bestGap - 0.5) / 2))
  const mid = start + bestGap / 2
  return [mid - spread, mid + spread]
}
