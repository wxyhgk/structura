import { atomIdsOfSelection, componentOf } from "@structura/core/molecule"
import type { Bracket, Molecule, Selection } from "@structura/core/types"
import type { ContextTarget } from "./context.ts"

/**
 * The atoms a right-click menu's copying and analysis act on: the selection, the molecule
 * of the atom or bond clicked, a bracket's atoms, or none (on empty canvas, or before any
 * right-click), which the menu's actions take as the whole drawing.
 */
export function contextAtoms(mol: Molecule, selection: Selection, target: ContextTarget | null, brackets?: readonly Bracket[]): number[] {
  if (target?.kind === "selection") return atomIdsOfSelection(mol, selection)
  if (target?.kind === "bracket") return brackets?.find((bracket) => bracket.id === target.id)?.atoms ?? []
  if (target?.kind === "atom") return componentOf(mol, target.id)
  if (target?.kind === "bond") {
    const bond = mol.bonds.find((item) => item.id === target.id)
    return bond ? componentOf(mol, bond.a) : []
  }
  return []
}
