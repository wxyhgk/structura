import { elementMass } from "./elements/index.ts"
import { atomHydrogens, elementCounts, isotopeMass } from "./formula.ts"
import { atomById } from "./molecule/graph.ts"
import type { Molecule } from "./types.ts"

// Numbers a chemist writes in the experimental section: exact (monoisotopic) mass, the m/z
// of common ions, and the elemental analysis, for a molecule or part of one.

/** The most abundant isotope's mass of each element people draw (IUPAC/NIST values). */
const MONOISOTOPIC: Record<string, number> = {
  H: 1.0078250319, D: 2.0141017778, T: 3.0160492777, B: 11.0093054, C: 12, N: 14.0030740052, O: 15.9949146221, F: 18.99840320,
  Na: 22.98976966, Mg: 23.98504187, Al: 26.98153841, Si: 27.9769265327, P: 30.97376151, S: 31.97207069, Cl: 34.96885271, K: 38.9637069,
  Ca: 39.9625912, Ti: 47.9479471, Cr: 51.9405119, Mn: 54.9380496, Fe: 55.9349421, Co: 58.9332002, Ni: 57.9353479, Cu: 62.9296011,
  Zn: 63.9291466, Ge: 73.9211782, As: 74.9215964, Se: 79.9165218, Br: 78.9183376, Rb: 84.9117893, Sr: 87.9056143, Zr: 89.9047037,
  Ru: 101.9043495, Rh: 102.905504, Pd: 105.903483, Ag: 106.905093, Cd: 113.9033581, Sn: 119.9021966, Te: 129.9062228, I: 126.904468,
  Cs: 132.905447, Ba: 137.905241, Eu: 152.921226, Gd: 157.924101, Tb: 158.925343, Os: 191.961479, Ir: 192.962924, Pt: 194.964774,
  Au: 196.966552, Hg: 201.970626, Pb: 207.976636, Bi: 208.980383, Li: 7.016004,
}

/** The electron's mass: a cation weighs this much less than the molecule it came from. */
export const ELECTRON = 0.00054857990946

/** The exact (monoisotopic) mass of the atoms and their hydrogens; drawn isotopes count as drawn. Null when an element has no value here. */
export function exactMass(mol: Molecule, atomIds?: number[]): number | null {
  let total = 0
  for (const id of atomIds ?? mol.atoms.map((atom) => atom.id)) {
    const atom = atomById(mol, id)
    if (!atom || atom.alias) continue
    const own = atom.isotope != null ? isotopeMass(atom.el, atom.isotope) : MONOISOTOPIC[atom.el]
    if (own == null) return null
    const { h, error } = atomHydrogens(mol, id)
    total += own + (error ? 0 : h * MONOISOTOPIC.H)
  }
  return total
}

/** The net charge drawn on the atoms. */
export function netCharge(mol: Molecule, atomIds?: number[]): number {
  return (atomIds ?? mol.atoms.map((atom) => atom.id)).reduce((sum, id) => sum + (atomById(mol, id)?.charge ?? 0), 0)
}

/** Each element's share of the mass, in percent, C and H first: what an elemental analysis reports. */
export function elementalAnalysis(mol: Molecule, atomIds?: number[]): Array<{ symbol: string; percent: number }> {
  const counts = elementCounts(mol, atomIds)
  const masses = [...counts].map(([symbol, count]) => ({ symbol, mass: count * (symbol === "D" || symbol === "T" ? MONOISOTOPIC[symbol] : elementMass(symbol)) }))
  const total = masses.reduce((sum, item) => sum + item.mass, 0)
  if (total === 0) return []
  const order = (symbol: string) => (symbol === "C" ? 0 : symbol === "H" ? 1 : 2)
  return masses
    .sort((a, b) => order(a.symbol) - order(b.symbol) || a.symbol.localeCompare(b.symbol))
    .map(({ symbol, mass }) => ({ symbol, percent: (mass / total) * 100 }))
}
