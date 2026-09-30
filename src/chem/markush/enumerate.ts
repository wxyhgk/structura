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
  /** Why some or all combinations could not be built. */
  problems: string[]
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
  const problems = undefinedVariables(drawing).map((name) => `${name} has no alternatives yet, so it stays a placeholder`)
  const classesLeftOut: Record<string, number> = {}
  const sites: Site[] = placeholders(drawing).map(({ atom, name }) => {
    const alternatives = variables[name].alternatives
    const classes = alternatives.filter((item) => item.kind === "class").length
    if (classes > 0) classesLeftOut[name] = classes
    const labels = alternatives.flatMap((item) => (item.kind === "label" ? [item.text] : []))
    return { atom, name, labels, inChain: neighbors(drawing.molecule, atom).length >= 2 }
  })
  const empty = [...new Set(sites.filter((site) => site.labels.length === 0).map((site) => site.name))]
  if (empty.length > 0) {
    problems.push(`${empty.join(", ")} ${empty.length > 1 ? "have" : "has"} only classes, which are not expanded; give ${empty.length > 1 ? "them" : "it"} concrete alternatives to enumerate`)
    return { molecules: [], total: 0, classesLeftOut, problems }
  }
  const total = sites.reduce((product, site) => product * site.labels.length, 1)
  const molecules: Molecule[] = []
  const failures = new Set<string>()
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
    else failures.add(chosen.map(({ site, text }) => `${site.name} = ${text}`).join(", ") + `: ${result.error}`)
    for (let index = sites.length - 1; index >= 0; index--) {
      choice[index]++
      if (choice[index] < sites[index].labels.length) break
      choice[index] = 0
    }
  }
  if (failures.size > 0) problems.push(...[...failures].slice(0, 5), ...(failures.size > 5 ? [`and ${failures.size - 5} more combinations could not be built`] : []))
  return { molecules, total, classesLeftOut, problems }
}
