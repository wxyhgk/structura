import { bondById } from "@/chem/molecule"
import { applyOps, type Op } from "@/chem/ops"
import type { BondStyle, Molecule, RingKind } from "@/chem/types"

/** Runs edits through the op layer and commits the result. Returns false if rejected. */
export function runOps(
  mol: Molecule,
  ops: Op[],
  commit: (mol: Molecule, keepSelection?: boolean) => void,
  keepSelection = false,
): boolean {
  const result = applyOps(mol, ops)
  if (!result.ok) {
    console.warn(`edit rejected at op ${result.index}: ${result.error}`)
    return false
  }
  commit(result.mol, keepSelection)
  return true
}

/** The ring tool's kinds as add_ring sizes. Cyclopentene has no op form. */
export function ringShape(kind: RingKind): { size: number; aromatic?: boolean } | null {
  const shapes: Partial<Record<RingKind, { size: number; aromatic?: boolean }>> = {
    benzene: { size: 6, aromatic: true },
    cyclohexane: { size: 6 },
    cyclopentane: { size: 5 },
    cyclobutane: { size: 4 },
    cyclopropane: { size: 3 },
    cycloheptane: { size: 7 },
    cyclooctane: { size: 8 },
  }
  return shapes[kind] ?? null
}

/** Clicking a bond with the bond tool: a plain single tool cycles the order, others restyle it. */
export function paintOps(mol: Molecule, bondId: number, style: BondStyle): Op[] {
  const bond = bondById(mol, bondId)
  if (!bond) return []
  if (style.order === 1 && style.stereo === "none" && !style.look && bond.stereo === "none" && !bond.look) {
    return [{ op: "set_bond", bond: bondId, order: bond.order === 1 ? 2 : bond.order === 2 ? 3 : 1 }]
  }
  return [{ op: "set_bond", bond: bondId, order: style.order, stereo: style.stereo, look: style.look ?? null }]
}
