import { displayFormula, molecularWeight, plainFormula, valenceErrorCount } from "@structura/core/formula"
import { atomIdsOfSelection } from "@structura/core/molecule"
import type { Molecule, Selection } from "@structura/core/types"

/** The status bar's figures: formula and weight of the selection (or everything), and valence problems. */
export function statusOf(mol: Molecule, selection: Selection) {
  const source = selection.atoms.length > 0 ? selection.atoms : undefined
  const formula = plainFormula(mol, source)
  return {
    formula: displayFormula(formula),
    weight: formula ? molecularWeight(mol, source) : 0,
    valenceErrors: valenceErrorCount(mol),
  }
}

/** Rotating, flipping and tumbling need at least two atoms selected. */
export function canTransform(mol: Molecule, selection: Selection): boolean {
  return atomIdsOfSelection(mol, selection).length >= 2
}
