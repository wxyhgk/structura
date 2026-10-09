import { elementOf } from "./elements/index.ts"
import { groupOrAlias, insertGroup } from "./molecule/abbreviate.ts"
import { setAlias, setElement, setIsotope } from "./molecule/graph.ts"
import { bondsOf } from "./molecule/lookup.ts"
import { ARYL, HYDROGEN_ISOTOPES, hydrideElement, isotopeLabel } from "./label/known.ts"
import { GROUP_FIRST, templateFor } from "./templates.ts"
import type { Molecule } from "./types.ts"

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
