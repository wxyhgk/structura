import { neighbors } from "../molecule.ts"
import { applyOps, type Op } from "../ops.ts"
import type { Drawing, Molecule } from "../types.ts"
import { placeholders, undefinedVariables } from "./variables.ts"

export type Enumeration = {
  /** Concrete molecules, in order, at most `limit` of them. */
  molecules: Molecule[]
  /** How many combinations the concrete alternatives allow, generated or not. */
  total: number
  /** Per variable, how many class alternatives were left out (classes are never expanded). */
  classesLeftOut: Record<string, number>
  /** Placeholder labels with no definition: they stay placeholders in every molecule. */
  undefinedNames: string[]
  /** Variables with only classes: nothing concrete to put there, so nothing is generated. */
  onlyClasses: string[]
  /** Combinations that could not be built, and why (at most five are kept). */
  failures: Array<{ choice: Array<{ name: string; text: string }>; error: string }>
  /** How many combinations failed in all. */
  failed: number
}

/** One placeholder atom and the labels it may take. */
type Site = { atom: number; name: string; labels: string[]; inChain: boolean }

/**
 * What putting `text` on a placeholder takes. A terminal one is swapped for the piece (or
 * dropped for H, leaving an implicit hydrogen); one inside a ring or chain is relabelled
 * in place, which suits an atom such as X = O or S.
 */
function opsFor(site: Site, text: string): Op[] {
  if (site.inChain) return [{ op: "label", atom: site.atom, text }]
  if (text === "H") return [{ op: "remove", atoms: [site.atom] }]
  return [{ op: "replace", atoms: [site.atom], with: { label: text } }]
}

/**
 * Expands a generic formula into concrete molecules: every combination of each
 * placeholder's label alternatives, each placeholder choosing on its own. Class
 * alternatives ("(C1-C30)alkyl") stay classes and are left out, as noted in the result.
 */
export function enumerate(drawing: Drawing, limit = 1000): Enumeration {
  const variables = drawing.variables ?? {}
  const undefinedNames = undefinedVariables(drawing)
  const classesLeftOut: Record<string, number> = {}
  const sites: Site[] = placeholders(drawing).map(({ atom, name }) => {
    const alternatives = variables[name].alternatives
    const classes = alternatives.filter((item) => item.kind === "class").length
    if (classes > 0) classesLeftOut[name] = classes
    const labels = alternatives.flatMap((item) => (item.kind === "label" ? [item.text] : []))
    return { atom, name, labels, inChain: neighbors(drawing.molecule, atom).length >= 2 }
  })
  const onlyClasses = [...new Set(sites.filter((site) => site.labels.length === 0).map((site) => site.name))]
  if (onlyClasses.length > 0) return { molecules: [], total: 0, classesLeftOut, undefinedNames, onlyClasses, failures: [], failed: 0 }
  const total = sites.reduce((product, site) => product * site.labels.length, 1)
  const molecules: Molecule[] = []
  const failures: Enumeration["failures"] = []
  let failed = 0
  const base: Drawing = { molecule: drawing.molecule, arrows: [], nextArrowId: drawing.nextArrowId }
  // An odometer over the sites: the last placeholder turns fastest.
  const choice = sites.map(() => 0)
  for (let made = 0; made < Math.min(total, limit); made++) {
    // Relabelling in place first, then swaps, then removals, so no op aims at an atom already gone.
    const chosen = sites.map((site, index) => ({ site, text: site.labels[choice[index]] }))
    const order = (item: (typeof chosen)[number]) => (item.site.inChain ? 0 : item.text === "H" ? 2 : 1)
    const ops = [...chosen].sort((a, b) => order(a) - order(b)).flatMap(({ site, text }) => opsFor(site, text))
    const result = applyOps(base, ops)
    if (result.ok) molecules.push(result.drawing.molecule)
    else if (failed++ < 5) failures.push({ choice: chosen.map(({ site, text }) => ({ name: site.name, text })), error: result.error })
    for (let index = sites.length - 1; index >= 0; index--) {
      choice[index]++
      if (choice[index] < sites[index].labels.length) break
      choice[index] = 0
    }
  }
  return { molecules, total, classesLeftOut, undefinedNames, onlyClasses: [], failures, failed }
}
