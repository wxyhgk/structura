import { BOND_LENGTH } from "../constants.ts"
import { dist } from "../geometry.ts"
import type { Molecule } from "../types.ts"
import { atomById, componentOf } from "./graph.ts"

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function bondLengths(mol: Molecule, atoms?: Set<number>): number[] {
  const lengths: number[] = []
  for (const bond of mol.bonds) {
    if (atoms && !atoms.has(bond.a)) continue
    const a = atomById(mol, bond.a)
    const b = atomById(mol, bond.b)
    if (a && b) lengths.push(dist(a, b))
  }
  return lengths.filter((length) => length > 1)
}

/**
 * The bond length for new atoms next to `atomId`: the median bond of its piece of the
 * drawing, so bonds, rings and groups added to a scaled structure match it. Without an
 * atom it is the median of the whole drawing; with no bonds at all, the default.
 */
export function bondLengthAt(mol: Molecule, atomId?: number): number {
  if (atomId != null) {
    const local = median(bondLengths(mol, new Set(componentOf(mol, atomId))))
    if (local != null) return local
  }
  return median(bondLengths(mol)) ?? BOND_LENGTH
}
