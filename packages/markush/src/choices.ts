import { elementOf } from "@structura/core/elements"
import { applyOps } from "@structura/core/ops"
import type { Choice, Drawing, Variable } from "@structura/core/types"
import { alternativesOf, fragmentFits, fragmentFormula, fragmentVariables, fragmentVersions } from "@structura/core/markush"
import { odometer } from "./odometer.ts"
import type { Pick } from "./picks.ts"
import { opsForAll, type Site } from "./place.ts"
import { placeholders } from "./queries.ts"
import { representativesOf } from "./representatives.ts"
import { siteKind, type SiteKind } from "./sites.ts"

const same = (a: Choice, b: Choice) => JSON.stringify(a) === JSON.stringify(b)

/** How deep pieces may sit inside pieces (Ar = N–R5, R5 = …) before the rest is left out. */
const NESTING = 4

/** The name of a piece joined by its `index`-th joining atom (0-based): "C₅H₄N（位点 2）". */
export const joiningSiteName = (base: string, index: number): string => `${base}（位点 ${index + 1}）`

/**
 * Whether a choice can go where a placeholder sits. A branch end takes a group or an atom
 * (never a bond or a divalent ring); a ring position takes an element; a linker takes a
 * bond, a divalent ring or an element such as O or S, never a group that ends a branch.
 * A drawn piece goes wherever its "*" marks match the placeholder's bonds (see fragmentFits).
 */
function fits(drawing: Drawing, atom: number, where: SiteKind, choice: Choice): boolean {
  if (choice.kind === "fragment") return fragmentFits(drawing.molecule, atom, choice.molecule)
  if (where === "end") return choice.kind === "label"
  const element = choice.kind === "label" && elementOf(choice.text) != null
  if (where === "ring") return element
  return choice.kind !== "label" || element
}

/** What each variable may concretely become, worked out once per variable, with what was left out on the way. */
export type ChoiceResolver = {
  /** The sites of a drawing's placeholders, each with the choices that fit there (misfits noted). */
  sitesOf(drawing: Drawing, stack: string[]): Site[]
  /** A variable's concrete choices, counting its classes once however many atoms carry it. */
  choicesFor(name: string): Choice[]
  /** For a piece made concrete, what the placeholders inside it became. */
  inside: WeakMap<Choice, Pick[]>
  /** Per variable, how many class alternatives were left out. */
  classesLeftOut: Record<string, number>
  /** Per variable, the representatives that stood in for its classes. */
  represented: Record<string, Choice[]>
  /** Per variable, choices that cannot go where its placeholder sits. */
  misfits: Record<string, Choice[]>
}

/** Resolves the variables of `variables` into concrete choices, with representatives for classes when asked. */
export function choiceResolver(variables: Record<string, Variable>, representatives: boolean): ChoiceResolver {
  const defined = new Set(Object.keys(variables))
  const classesLeftOut: Record<string, number> = {}
  const represented: Record<string, Choice[]> = {}
  const misfits: Record<string, Choice[]> = {}
  const choicesOf = new Map<string, Choice[]>()
  const inside = new WeakMap<Choice, Pick[]>()
  const misfit = (name: string, choice: Choice) => {
    if (!(misfits[name] ?? []).some((other) => same(other, choice))) misfits[name] = [...(misfits[name] ?? []), choice]
  }
  const sitesOf = (drawing: Drawing, stack: string[]): Site[] =>
    placeholders(drawing).map(({ atom, name }) => {
      const where = siteKind(drawing, atom)
      const all = stack.includes(name) ? [] : choicesFor(name, stack)
      for (const choice of all) if (!fits(drawing, atom, where, choice)) misfit(name, choice)
      return { atom, name, where, choices: all.filter((choice) => fits(drawing, atom, where, choice)) }
    })
  /**
   * A variable's concrete choices: its own, representatives for its classes when asked, and
   * each piece with placeholders inside (Ar = N–R5) made concrete every way they can be.
   */
  function choicesFor(name: string, stack: string[] = []): Choice[] {
    const known = choicesOf.get(name)
    if (known) return known
    const alternatives = alternativesOf(variables, name)
    const choices: Choice[] = alternatives.flatMap((item) => (item.kind === "class" ? [] : item.kind === "fragment" ? joinings(item) : [item]))
    for (const item of alternatives) {
      if (item.kind !== "class") continue
      const standIns = representatives ? representativesOf(item).filter((choice) => !choices.some((other) => same(other, choice))) : []
      if (standIns.length === 0) classesLeftOut[name] = (classesLeftOut[name] ?? 0) + 1
      choices.push(...standIns)
      if (standIns.length > 0) represented[name] = [...(represented[name] ?? []), ...standIns]
    }
    const concrete = choices.flatMap((choice) =>
      choice.kind === "fragment" && fragmentVariables(choice.molecule).some((inner) => defined.has(inner)) ? filled(choice, [...stack, name]) : [choice],
    )
    choicesOf.set(name, concrete)
    return concrete
  }
  /**
   * A piece that may join by several of its atoms, as one choice per joining atom, each named
   * by its site (see joiningSiteName) so the compounds made from them can be told apart.
   */
  function joinings(piece: Extract<Choice, { kind: "fragment" }>): Choice[] {
    const { alsoAt, ...plain } = piece
    if (!alsoAt?.length) return [plain]
    const base = piece.name ?? fragmentFormula(piece.molecule)
    return fragmentVersions(piece.molecule, alsoAt).map((molecule, index) => ({ kind: "fragment", molecule, name: joiningSiteName(base, index) }))
  }
  /** Every concrete version of a piece, its inner placeholders filled with the choices that fit them. */
  function filled(piece: Extract<Choice, { kind: "fragment" }>, stack: string[]): Choice[] {
    if (stack.length > NESTING) return []
    const drawing: Drawing = { molecule: piece.molecule, arrows: [], nextArrowId: 1, variables }
    const sites = sitesOf(drawing, stack)
    const versions: Choice[] = []
    for (const index of odometer(sites.map((site) => site.choices.length))) {
      const chosen = sites.map((site, at) => ({ site, choice: site.choices[index[at]] }))
      const built = applyOps({ ...drawing, variables: undefined }, opsForAll(chosen))
      if (!built.ok) continue
      const version: Choice = { kind: "fragment", molecule: built.drawing.molecule, ...(piece.name != null ? { name: piece.name } : {}) }
      inside.set(version, chosen.flatMap(({ site, choice }) => [{ name: site.name, choice }, ...(inside.get(choice) ?? [])]))
      versions.push(version)
    }
    return versions
  }
  return { sitesOf, choicesFor: (name) => choicesFor(name), inside, classesLeftOut, represented, misfits }
}
