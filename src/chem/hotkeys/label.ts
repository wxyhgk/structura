import { elementOf } from "../elements/index.ts"
import { insertGroup, setAlias, setElement, setIsotope } from "../molecule.ts"
import { GROUP_FIRST, templateFor } from "../templates.ts"
import type { Molecule } from "../types.ts"

const HYDROGEN_ISOTOPES: Record<string, { el: string; isotope: number }> = {
  D: { el: "H", isotope: 2 },
  T: { el: "H", isotope: 3 },
}

/** "13C" or "15N": a mass number in front of an element symbol. */
function isotopeLabel(text: string): { el: string; isotope: number } | null {
  const match = /^(\d{1,3})([A-Z][a-z]?)$/.exec(text)
  if (!match || !elementOf(match[2])) return null
  return { el: match[2], isotope: Number(match[1]) }
}

export function setAtomLabel(mol: Molecule, id: number, text: string): Molecule {
  const trimmed = text.trim()
  if (!trimmed) return setAlias(mol, id, undefined)
  const template = templateFor(trimmed)
  if (template && GROUP_FIRST.has(trimmed)) return insertGroup(mol, id, template, trimmed)?.mol ?? mol
  if (elementOf(trimmed)) return setElement(mol, [id], trimmed)
  const heavy = HYDROGEN_ISOTOPES[trimmed] ?? isotopeLabel(trimmed)
  if (heavy) return setIsotope(setElement(mol, [id], heavy.el), [id], heavy.isotope)
  const placed = template ? insertGroup(mol, id, template, trimmed) : null
  if (placed) return placed.mol
  return setAlias(setElement(mol, [id], "C"), id, trimmed)
}
