import { atomById, bondById, componentOf, selectionFromAtoms } from "@structura/core/molecule"
import type { Molecule, Selection } from "@structura/core/types"
import type { HoverTarget } from "./types.ts"

/** What a double click does, as in ChemDraw: on an atom, edit its label; on a bond, select its molecule. */
export type DoubleClick = { kind: "label"; atom: number } | { kind: "select"; selection: Selection }

export function doubleClickAction(mol: Molecule, hit: HoverTarget): DoubleClick | null {
  if (hit?.type === "atom") return atomById(mol, hit.id) ? { kind: "label", atom: hit.id } : null
  if (hit?.type === "bond") {
    const bond = bondById(mol, hit.id)
    return bond ? { kind: "select", selection: selectionFromAtoms(mol, componentOf(mol, bond.a)) } : null
  }
  return null
}
