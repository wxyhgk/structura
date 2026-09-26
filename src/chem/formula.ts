import { elementByNumber, elementMass, elementOf } from "./elements/index.ts"
import { atomById, bondOrderSum } from "./molecule.ts"
import type { Molecule } from "./types.ts"

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

const ALIAS_FORMULA: Record<string, Record<string, number>> = {
  Me: { C: 1, H: 3 },
  CH3: { C: 1, H: 3 },
  Et: { C: 2, H: 5 },
  Ac: { C: 2, H: 3, O: 1 },
  Ph: { C: 6, H: 5 },
  Boc: { C: 5, H: 9, O: 2 },
  Cbz: { C: 8, H: 7, O: 2 },
  Fmoc: { C: 15, H: 11, O: 2 },
  CO2Me: { C: 2, H: 3, O: 2 },
  D: { H: 1 },
}

export function atomHydrogens(mol: Molecule, atomId: number): { h: number; error: boolean } {
  const atom = atomById(mol, atomId)
  if (!atom) return { h: 0, error: false }
  if (atom.alias) return { h: 0, error: false }
  return hydrogenCount(atom.el, atom.charge, bondOrderSum(mol, atomId))
}

function countsFor(mol: Molecule, atomIds?: number[]): Map<string, number> {
  const ids = atomIds ?? mol.atoms.map((atom) => atom.id)
  const counts = new Map<string, number>()
  const add = (el: string, amount: number) => counts.set(el, (counts.get(el) ?? 0) + amount)
  for (const id of ids) {
    const atom = atomById(mol, id)
    if (!atom) continue
    const alias = atom.alias ? ALIAS_FORMULA[atom.alias] : undefined
    if (alias) {
      for (const [el, count] of Object.entries(alias)) add(el, count)
      continue
    }
    add(atom.el, 1)
    const { h, error } = atomHydrogens(mol, id)
    if (!error && h > 0) add("H", h)
  }
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
  const counts = countsFor(mol, atomIds)
  let total = 0
  for (const [el, count] of counts) total += elementMass(el) * count
  return total
}

export function valenceErrorCount(mol: Molecule): number {
  let errors = 0
  for (const atom of mol.atoms) {
    if (atomHydrogens(mol, atom.id).error) errors += 1
  }
  return errors
}
