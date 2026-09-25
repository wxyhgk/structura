import { elementOf } from "../elements/index.ts"
import { setAlias, setElement } from "../molecule.ts"
import type { Molecule } from "../types.ts"

export function setAtomLabel(mol: Molecule, id: number, text: string): Molecule {
  const trimmed = text.trim()
  if (!trimmed) return setAlias(mol, id, undefined)
  if (elementOf(trimmed)) return setElement(mol, [id], trimmed)
  return setAlias(setElement(mol, [id], trimmed === "D" ? "H" : "C"), id, trimmed)
}
