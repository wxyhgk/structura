import { elementOf } from "./elements/index.ts"
import { groupOrAlias, insertGroup } from "./molecule/abbreviate.ts"
import { setAlias, setElement, setIsotope } from "./molecule/graph.ts"
import { bondsOf } from "./molecule/lookup.ts"
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
 * "OH", "NH2", "SH", "HO", "H2N": an element written with its hydrogens, as chemists type
 * a heteroatom. The atom is that element; its hydrogens stay implicit, counted from valence.
 */
function hydrideElement(text: string): string | null {
  const match = /^([A-Z][a-z]?)H\d?$/.exec(text) ?? /^H\d?([A-Z][a-z]?)$/.exec(text)
  return match && match[1] !== "H" && elementOf(match[1]) ? match[1] : null
}

/**
 * "Ar" typed in a drawing is the aryl placeholder of patents (Ar, Ar1, Ar'), not argon, so
 * it is no definite label. Only a lone atom typed Ar stays argon; the element tools and the
 * periodic table set argon anywhere.
 */
const ARYL = "Ar"

/**
 * Whether a label means a definite atom or group: an element (bare or with its hydrogens),
 * a hydrogen isotope or mass number, or a known abbreviation. Anything else would only
 * ever be a placeholder.
 */
export function knownLabel(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed === ARYL) return false
  return Boolean(templateFor(trimmed) || elementOf(trimmed) || hydrideElement(trimmed) || HYDROGEN_ISOTOPES[trimmed] || isotopeLabel(trimmed))
}

export function setAtomLabel(mol: Molecule, id: number, text: string): Molecule {
  const trimmed = text.trim()
  if (!trimmed) return setAlias(mol, id, undefined)
  const template = templateFor(trimmed)
  if (template && GROUP_FIRST.has(trimmed)) return insertGroup(mol, id, template, trimmed)?.mol ?? mol
  if (trimmed === ARYL && bondsOf(mol, id).length > 0) return setAlias(setElement(mol, [id], "C"), id, ARYL)
  if (elementOf(trimmed)) return setElement(mol, [id], trimmed)
  // A group's own spelling (CH3 for Me) wins over reading it as an element with hydrogens.
  const hydride = template ? null : hydrideElement(trimmed)
  if (hydride) return setElement(mol, [id], hydride)
  const heavy = HYDROGEN_ISOTOPES[trimmed] ?? isotopeLabel(trimmed)
  if (heavy) return setIsotope(setElement(mol, [id], heavy.el), [id], heavy.isotope)
  return groupOrAlias(mol, id, trimmed).mol
}
