import { elementByNumber, elementMass, elementOf } from "./elements/index.ts"
import { atomById, bondOrderSum } from "./molecule/graph.ts"
import type { Atom, Molecule } from "./types.ts"

const SUBSCRIPT = "₀₁₂₃₄₅₆₇₈₉"

type ValenceList = { valences: number[]; anyAbove?: boolean }

/**
 * RDKit's valences for elements that only matter here as the stand-in for a charged
 * atom (Be for B+, Ar for Cl-, Xe for I-). Uncharged, these elements get no hydrogens.
 * `anyAbove` marks the alkali and alkaline earth metals, which RDKit lets take any
 * higher valence without hydrogens.
 */
const STAND_INS: Record<number, ValenceList> = {
  3: { valences: [1], anyAbove: true },
  4: { valences: [2] },
  10: { valences: [0] },
  11: { valences: [1], anyAbove: true },
  12: { valences: [2], anyAbove: true },
  13: { valences: [3] },
  18: { valences: [0] },
  19: { valences: [1], anyAbove: true },
  31: { valences: [3] },
  32: { valences: [4] },
  36: { valences: [0] },
  37: { valences: [1], anyAbove: true },
  50: { valences: [2, 4] },
  51: { valences: [3, 5] },
  54: { valences: [0, 2, 4, 6] },
  55: { valences: [1] },
}

const PERIOD_STARTS = [1, 3, 11, 19, 37, 55, 87]

function period(z: number): number {
  return PERIOD_STARTS.filter((start) => z >= start).length
}

function valencesOf(z: number): ValenceList | undefined {
  const valences = elementByNumber(z)?.valences
  return valences ? { valences } : STAND_INS[z]
}

/**
 * The valences a charged atom may fill up to, reproducing RDKit (see valence.test.ts).
 * A cation, a boron-group anion, or an ion whose electron count reaches the next period
 * behaves like its isoelectronic element: N+ like C, B- like C, I2- like Cs. Other anions
 * may also keep their own valences lowered by the charge, so S- takes 1, 3 or 5.
 */
function chargedValences(z: number, col: number, charge: number): ValenceList | undefined {
  const stand = valencesOf(z - charge)
  if (charge > 0 || col <= 13 || period(z - charge) !== period(z)) return stand
  const own = (valencesOf(z)?.valences ?? []).map((valence) => valence + charge).filter((valence) => valence >= 0)
  const merged = [...new Set([...(stand?.valences ?? []), ...own])].sort((a, b) => a - b)
  return { valences: merged, anyAbove: stand?.anyAbove }
}

/**
 * Implicit hydrogens the way RDKit counts them: the atom fills up to the lowest valence
 * its bonds fit under. Hypervalent states such as N in N(=O)=O are accepted only when the
 * bonds reach them exactly, the way RDKit accepts them after tidying the group up.
 */
export function hydrogenCount(
  el: string,
  charge: number,
  bondSum: number,
): { h: number; error: boolean } {
  if (el === "H") return { h: 0, error: bondSum > 1 }
  const element = elementOf(el)
  if (!element?.valences) return { h: 0, error: false }
  const list = charge === 0 ? { valences: element.valences } : chargedValences(element.z, element.col, charge)
  if (!list) return { h: 0, error: true }
  const fit = list.valences.find((valence) => valence >= bondSum)
  if (fit != null) return { h: fit - bondSum, error: false }
  if (list.anyAbove && list.valences.length > 0) return { h: 0, error: false }
  if (charge === 0 && element.hypervalent?.includes(bondSum)) return { h: 0, error: false }
  return { h: 0, error: true }
}

/** Exact masses of the isotopes people draw; others fall back to their mass number. */
const ISOTOPE_MASS: Record<string, number> = {
  H2: 2.014102,
  H3: 3.016049,
  C13: 13.003355,
  C14: 14.003242,
  N15: 15.000109,
  O17: 16.999132,
  O18: 17.99916,
  F18: 18.000938,
  P32: 31.973907,
  S34: 33.967867,
  Cl37: 36.965903,
  Br81: 80.916291,
  I125: 124.90463,
  I131: 130.906125,
}

/** Deuterium and tritium keep their own letters in formulas, as in CH3D. */
function formulaSymbol(atom: Atom): string {
  if (atom.el === "H" && atom.isotope === 2) return "D"
  if (atom.el === "H" && atom.isotope === 3) return "T"
  return atom.el
}

function atomMass(atom: Atom): number {
  if (atom.isotope == null) return elementMass(atom.el)
  return ISOTOPE_MASS[`${atom.el}${atom.isotope}`] ?? atom.isotope
}

export function atomHydrogens(mol: Molecule, atomId: number): { h: number; error: boolean } {
  const atom = atomById(mol, atomId)
  if (!atom) return { h: 0, error: false }
  if (atom.alias) return { h: 0, error: false }
  return hydrogenCount(atom.el, atom.charge, bondOrderSum(mol, atomId))
}

/** Walks the atoms once, handing each piece of the formula to `add` with its mass. */
function eachPiece(mol: Molecule, atomIds: number[] | undefined, add: (symbol: string, count: number, mass: number) => void) {
  const ids = atomIds ?? mol.atoms.map((atom) => atom.id)
  for (const id of ids) {
    const atom = atomById(mol, id)
    if (!atom) continue
    // A labelled placeholder (R, X, anything typed that is not a known group) is not an atom.
    if (atom.alias) continue
    add(formulaSymbol(atom), 1, atomMass(atom))
    const { h, error } = atomHydrogens(mol, id)
    if (!error && h > 0) add("H", h, elementMass("H"))
  }
}

function countsFor(mol: Molecule, atomIds?: number[]): Map<string, number> {
  const counts = new Map<string, number>()
  eachPiece(mol, atomIds, (symbol, count) => counts.set(symbol, (counts.get(symbol) ?? 0) + count))
  return counts
}

export function plainFormula(mol: Molecule, atomIds?: number[]): string {
  const counts = countsFor(mol, atomIds)
  if (counts.size === 0) return ""
  const hasCarbon = counts.has("C")
  const entries = [...counts.entries()].sort((a, b) => {
    if (hasCarbon) {
      if (a[0] === "C") return -1
      if (b[0] === "C") return 1
      if (a[0] === "H") return -1
      if (b[0] === "H") return 1
    }
    return a[0].localeCompare(b[0])
  })
  return entries.map(([el, count]) => (count === 1 ? el : `${el}${count}`)).join("")
}

export function displayFormula(formula: string): string {
  return formula.replace(/\d+/g, (digits) =>
    [...digits].map((digit) => SUBSCRIPT[Number(digit)] ?? digit).join(""),
  )
}

export function molecularWeight(mol: Molecule, atomIds?: number[]): number {
  let total = 0
  eachPiece(mol, atomIds, (_symbol, count, mass) => {
    total += mass * count
  })
  return total
}

export function valenceErrorCount(mol: Molecule): number {
  let errors = 0
  for (const atom of mol.atoms) {
    if (atomHydrogens(mol, atom.id).error) errors += 1
  }
  return errors
}
