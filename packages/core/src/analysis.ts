import { COMMON_ISOTOPE } from "./elements/isotopes.ts"
import { atomHydrogens, elementMasses, isotopeMass } from "./formula.ts"
import { atomById } from "./molecule/graph.ts"
import type { Molecule } from "./types.ts"

// Numbers a chemist writes in the experimental section: exact (monoisotopic) mass, the m/z
// of common ions, and the elemental analysis, for a molecule or part of one.

/** The exact mass of an element's most common isotope (D and T as drawn), or undefined for one with none known. */
function monoisotopic(symbol: string): number | undefined {
  if (symbol === "D") return isotopeMass("H", 2)
  if (symbol === "T") return isotopeMass("H", 3)
  return Object.hasOwn(COMMON_ISOTOPE, symbol) ? isotopeMass(symbol, COMMON_ISOTOPE[symbol]) : undefined
}

/** The electron's mass: a cation weighs this much less than the molecule it came from. */
export const ELECTRON = 0.00054857990946

/** The exact (monoisotopic) mass of the atoms and their hydrogens; drawn isotopes count as drawn. Null when an element has no value here. */
export function exactMass(mol: Molecule, atomIds?: number[]): number | null {
  let total = 0
  for (const id of atomIds ?? mol.atoms.map((atom) => atom.id)) {
    const atom = atomById(mol, id)
    if (!atom || atom.alias) continue
    const own = atom.isotope != null ? isotopeMass(atom.el, atom.isotope) : monoisotopic(atom.el)
    if (own == null) return null
    const { h, error } = atomHydrogens(mol, id)
    total += own + (error ? 0 : h * monoisotopic("H")!)
  }
  return total
}

/** The net charge drawn on the atoms. */
export function netCharge(mol: Molecule, atomIds?: number[]): number {
  return (atomIds ?? mol.atoms.map((atom) => atom.id)).reduce((sum, id) => sum + (atomById(mol, id)?.charge ?? 0), 0)
}

/** Each element's share of the mass, in percent, C and H first: what an elemental analysis reports. */
export function elementalAnalysis(mol: Molecule, atomIds?: number[]): Array<{ symbol: string; percent: number }> {
  // Weighed as molecularWeight weighs them, so a 13C label counts as 13.003, not as natural C.
  const masses = [...elementMasses(mol, atomIds)].map(([symbol, mass]) => ({ symbol, mass }))
  const total = masses.reduce((sum, item) => sum + item.mass, 0)
  if (total === 0) return []
  const order = (symbol: string) => (symbol === "C" ? 0 : symbol === "H" ? 1 : 2)
  return masses
    .sort((a, b) => order(a.symbol) - order(b.symbol) || a.symbol.localeCompare(b.symbol))
    .map(({ symbol, mass }) => ({ symbol, percent: (mass / total) * 100 }))
}
