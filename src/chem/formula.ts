import { elementMass, elementValences } from "./elements/index.ts"
import { atomById, bondOrderSum } from "./molecule.ts"
import type { Molecule } from "./types.ts"

const SUBSCRIPT = "₀₁₂₃₄₅₆₇₈₉"

export function hydrogenCount(
  el: string,
  charge: number,
  bondSum: number,
): { h: number; error: boolean } {
  if (el === "H") return { h: 0, error: bondSum > 1 }
  const list = elementValences(el)
  if (!list) return { h: 0, error: false }
  const candidates =
    el === "C"
      ? [Math.max(0, 4 - Math.abs(charge))]
      : list.map((valence) => valence + charge).filter((valence) => valence >= 0)
  let best: number | null = null
  for (const valence of candidates) {
    if (valence >= bondSum && (best == null || valence < best)) best = valence
  }
  if (best == null) {
    const max = candidates.length ? Math.max(...candidates) : 0
    return { h: max - bondSum, error: true }
  }
  return { h: best - bondSum, error: false }
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
