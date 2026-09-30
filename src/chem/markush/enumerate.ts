import { neighbors } from "../molecule.ts"
import { applyOps, type Op } from "../ops.ts"
import type { Drawing, Molecule } from "../types.ts"
import { representativesOf } from "./representatives.ts"
import { alternativesOf, placeholders, undefinedVariables } from "./variables.ts"

export type Enumeration = {
  /** Concrete molecules, in order, at most `limit` of them. */
  molecules: Molecule[]
  /** How many combinations the concrete alternatives allow, generated or not. */
  total: number
  /** Per variable, how many class alternatives were left out: all of them, unless representatives stand in. */
  classesLeftOut: Record<string, number>
  /** Per variable, the representative labels that stood in for its classes. */
  represented: Record<string, string[]>
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

export type EnumerateOptions = {
  /** Most molecules to build; the total is counted regardless. */
  limit?: number
  /** Let typical members stand in for each class (methyl, ethyl… for alkyl); else classes are left out. */
  representatives?: boolean
}

/**
 * Expands a generic formula into concrete molecules: every combination of each
 * placeholder's label alternatives, each placeholder choosing on its own. A class
 * ("(C1-C30)alkyl") is never expanded in full; it is left out, or with `representatives`
 * a few typical members inside its range stand in for it. The result says which.
 */
export function enumerate(drawing: Drawing, { limit = 1000, representatives = false }: EnumerateOptions = {}): Enumeration {
  const variables = drawing.variables ?? {}
  const undefinedNames = undefinedVariables(drawing)
  const classesLeftOut: Record<string, number> = {}
  const represented: Record<string, string[]> = {}
  const sites: Site[] = placeholders(drawing).map(({ atom, name }) => {
    const alternatives = alternativesOf(variables, name)
    const labels = alternatives.flatMap((item) => (item.kind === "label" ? [item.text] : []))
    for (const item of alternatives) {
      if (item.kind !== "class") continue
      const standIns = representatives ? representativesOf(item).filter((label) => !labels.includes(label)) : []
      if (standIns.length === 0) classesLeftOut[name] = (classesLeftOut[name] ?? 0) + 1
      labels.push(...standIns)
      if (standIns.length > 0) represented[name] = [...(represented[name] ?? []), ...standIns]
    }
    return { atom, name, labels, inChain: neighbors(drawing.molecule, atom).length >= 2 }
  })
  const onlyClasses = [...new Set(sites.filter((site) => site.labels.length === 0).map((site) => site.name))]
  if (onlyClasses.length > 0) return { molecules: [], total: 0, classesLeftOut, represented, undefinedNames, onlyClasses, failures: [], failed: 0 }
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
  return { molecules, total, classesLeftOut, represented, undefinedNames, onlyClasses: [], failures, failed }
}
