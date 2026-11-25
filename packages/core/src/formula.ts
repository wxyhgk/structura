import { elementByNumber, elementMass, elementOf } from "./elements/index.ts"
import { ISOTOPES } from "./elements/isotopes.ts"
import { atomById, bondOrderSum } from "./molecule/graph.ts"
import type { Atom, Molecule } from "./types.ts"

const SUBSCRIPT = "₀₁₂₃₄₅₆₇₈₉"
const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹"

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
  18: { valences: [0] },
  19: { valences: [1], anyAbove: true },
  36: { valences: [0] },
  37: { valences: [1], anyAbove: true },
  54: { valences: [0, 2, 4, 6] },
  55: { valences: [1] },
  85: { valences: [1, 3, 5] },
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
 * The valences a charged atom may fill up to, reproducing RDKit (see tests/valence.test.ts).
 * A cation, a boron- or carbon-group anion, or an ion whose electron count reaches the next
 * period behaves like its isoelectronic element: N+ like C, B- like C, Sn- like Sb, I2- like
 * Cs. Other anions may also keep their own valences lowered by the charge, so S- takes 1, 3
 * or 5. An ion like a metal (Ga+ like Zn, Pb2+ like Hg) takes no hydrogens, as the metal.
 */
function chargedValences(z: number, col: number, charge: number): ValenceList | undefined {
  const stand = valencesOf(z - charge)
  if (charge > 0 || col <= 14 || period(z - charge) !== period(z)) return stand
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
  // Like a metal (no valences of its own): no hydrogens, and any number of bonds, as the metal.
  if (!list) return { h: 0, error: elementByNumber(element.z - charge) == null }
  const fit = list.valences.find((valence) => valence >= bondSum)
  if (fit != null) return { h: fit - bondSum, error: false }
  if (list.anyAbove && list.valences.length > 0) return { h: 0, error: false }
  if (charge === 0 && element.hypervalent?.includes(bondSum)) return { h: 0, error: false }
  return { h: 0, error: true }
}

/** Deuterium and tritium keep their own letters in formulas, as in CH3D. */
function formulaSymbol(atom: Atom): string {
  if (atom.el === "H" && atom.isotope === 2) return "D"
  if (atom.el === "H" && atom.isotope === 3) return "T"
  return atom.el
}

/**
 * A drawn isotope's exact mass (13C, D, 35Cl…), or its mass number for one that is neither
 * found in nature nor a common radiolabel.
 */
export function isotopeMass(el: string, isotope: number): number {
  return (Object.hasOwn(ISOTOPES, el) ? ISOTOPES[el][isotope] : undefined) ?? isotope
}

function atomMass(atom: Atom): number {
  return atom.isotope == null ? elementMass(atom.el) : isotopeMass(atom.el, atom.isotope)
}

export function atomHydrogens(mol: Molecule, atomId: number): { h: number; error: boolean } {
  const atom = atomById(mol, atomId)
  if (!atom) return { h: 0, error: false }
  if (atom.alias) return { h: 0, error: false }
  const sum = bondOrderSum(mol, atomId)
  // Neutral N reaches five only as nitro or an N-oxide drawn with N=O; five single bonds
  // (which hydrogenCount, seeing only the sum, would let pass) is no molecule.
  if (atom.el === "N" && atom.charge === 0 && sum === 5 && !mol.bonds.some((bond) => (bond.a === atomId || bond.b === atomId) && bond.order > 1)) {
    return { h: 0, error: true }
  }
  return hydrogenCount(atom.el, atom.charge, sum)
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

/** How many of each element (D and T apart) the atoms and their hydrogens hold; placeholders count for nothing. */
export function elementCounts(mol: Molecule, atomIds?: number[]): Map<string, number> {
  return countsFor(mol, atomIds)
}

function countsFor(mol: Molecule, atomIds?: number[]): Map<string, number> {
  const counts = new Map<string, number>()
  eachPiece(mol, atomIds, (symbol, count) => counts.set(symbol, (counts.get(symbol) ?? 0) + count))
  return counts
}

/**
 * The formula as plain text, Hill order (C, H, then the rest A to Z), ending with the net
 * charge as RDKit and ChemDraw give it: C6H6, C7H7+, C2H3O2-, C12H14N2+2.
 */
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
  return entries.map(([el, count]) => (count === 1 ? el : `${el}${count}`)).join("") + chargeSuffix(formulaCharge(mol, atomIds))
}

/** The net charge of the atoms a formula counts (placeholders count for nothing there either). */
function formulaCharge(mol: Molecule, atomIds: number[] | undefined): number {
  let charge = 0
  for (const id of atomIds ?? mol.atoms.map((atom) => atom.id)) {
    const atom = atomById(mol, id)
    if (atom && !atom.alias) charge += atom.charge
  }
  return charge
}

/** A net charge as a plain formula ends with it, the way RDKit writes it: +, -, +2, -3. */
function chargeSuffix(charge: number): string {
  if (charge === 0) return ""
  const sign = charge > 0 ? "+" : "-"
  return Math.abs(charge) === 1 ? sign : `${sign}${Math.abs(charge)}`
}

/** A plain formula for showing: counts as subscripts, a charge as a superscript (C₇H₇⁺, C₁₂H₁₄N₂²⁺). */
export function displayFormula(formula: string): string {
  const [, body, sign, size] = /^(.*?)(?:([+-])(\d*))?$/.exec(formula)!
  const sub = body.replace(/\d/g, (digit) => SUBSCRIPT[Number(digit)])
  if (!sign) return sub
  return `${sub}${[...size].map((digit) => SUPERSCRIPT[Number(digit)]).join("")}${sign === "+" ? "⁺" : "⁻"}`
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
