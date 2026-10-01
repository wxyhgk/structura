import { elementOf } from "./elements/index.ts"
import { groupOrAlias, insertGroup } from "./molecule/abbreviate.ts"
import { setAlias, setElement, setIsotope } from "./molecule/graph.ts"
import { GROUP_FIRST, templateFor } from "./templates.ts"
import type { Molecule } from "./types.ts"

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

/**
 * Whether a label means a definite atom or group: an element, a hydrogen isotope or mass
 * number, or a known abbreviation. Anything else would only ever be a placeholder.
 */
export function knownLabel(text: string): boolean {
  const trimmed = text.trim()
  return Boolean(templateFor(trimmed) || elementOf(trimmed) || HYDROGEN_ISOTOPES[trimmed] || isotopeLabel(trimmed))
}

export function setAtomLabel(mol: Molecule, id: number, text: string): Molecule {
  const trimmed = text.trim()
  if (!trimmed) return setAlias(mol, id, undefined)
  const template = templateFor(trimmed)
  if (template && GROUP_FIRST.has(trimmed)) return insertGroup(mol, id, template, trimmed)?.mol ?? mol
  if (elementOf(trimmed)) return setElement(mol, [id], trimmed)
  const heavy = HYDROGEN_ISOTOPES[trimmed] ?? isotopeLabel(trimmed)
  if (heavy) return setIsotope(setElement(mol, [id], heavy.el), [id], heavy.isotope)
  return groupOrAlias(mol, id, trimmed).mol
}
