import { knownLabel } from "@structura/core"
import { applyOps } from "@structura/core/ops"
import type { Drawing, Molecule } from "@structura/core/types"
import type { Choice } from "@structura/core/markush"
import { validate } from "@structura/core/validate"
import { isVariableName } from "@structura/core/markush"
import { choiceResolver } from "./choices.ts"
import { formulasOf } from "./formulas.ts"
import { odometer } from "./odometer.ts"
import type { Pick } from "./picks.ts"
import { opsForAll } from "./place.ts"
import { planFormulas, type Plan } from "./plans.ts"
import { excludedBy } from "./provisos.ts"
import { placeholders, undefinedVariables } from "./queries.ts"
import type { RepeatSkip } from "./repeats.ts"

export type Enumeration = {
  /** Concrete molecules, in order, at most `limit` of them. */
  molecules: Molecule[]
  /** For each molecule, what each variable became and where each attachment went. */
  picks: Pick[][]
  /** How many combinations the fitting choices allow, generated or not. */
  total: number
  /**
   * Attachment placements left out because a candidate position already carries something
   * other than a placeholder (a ring carbon with a methyl has no hydrogen left to replace).
   */
  occupied: number
  /** Per variable, how many class alternatives were left out: all of them, unless representatives stand in. */
  classesLeftOut: Record<string, number>
  /** Per variable, the representatives that stood in for its classes. */
  represented: Record<string, Choice[]>
  /**
   * Per variable, choices that cannot go where its placeholder sits, and were skipped: a
   * bond or a divalent ring at a branch end, a group inside a ring, a group where a linker is.
   */
  misfits: Record<string, Choice[]>
  /** Placeholder labels with no definition: they stay placeholders in every molecule. */
  undefinedNames: string[]
  /** Variables with nothing concrete to put there (only classes, or nothing that fits), so nothing is generated. */
  onlyClasses: string[]
  /** Combinations that could not be built, and why (at most five are kept). */
  failures: Array<{ choice: Pick[]; error: string }>
  /** How many combinations failed in all. */
  failed: number
  /** Built molecules dropped as repeats of one already made (only with `identity`). */
  duplicates: number
  /** How many separate formulas the drawing holds (formula I, formula II…); each is expanded on its own. */
  formulas: number
  /** For each molecule, which formula it came from (1, 2…), in drawing order. */
  formulaOf: number[]
  /** Combinations or compounds left out because a proviso of the claim excludes them. */
  excluded: number
  /** Excluded compounds (by SMILES) that could not be checked, for want of `identifySmiles`. */
  uncheckedCompounds: number
  /** Repeat units that cannot be written out (not exactly two bonds through their brackets), left as drawn. */
  skippedRepeats: RepeatSkip[]
}

/**
 * A label a built molecule must not keep: a defined variable's placeholder, or text that is
 * no element or group (so a choice put a word where a structure belonged). Placeholders of
 * variables with no definition are expected to stay.
 */
function leftover(mol: Molecule, defined: Set<string>): string | null {
  for (const atom of mol.atoms) {
    if (!atom.alias) continue
    if (defined.has(atom.alias)) return `the placeholder ${atom.alias} was not replaced`
    if (!isVariableName(atom.alias) && !knownLabel(atom.alias)) return `"${atom.alias}" is not a structure`
  }
  return null
}

/** Atoms with more bonds than their element allows. */
function overValence(mol: Molecule): Set<number> {
  return new Set(validate(mol).flatMap((problem) => (problem.code === "valence" ? problem.atoms ?? [] : [])))
}

/**
 * Why a built molecule is chemically wrong where the formula was not: an atom over its
 * valence that was fine before the choices went in. Strain the chemist drew stays theirs.
 */
function newlyOverValence(mol: Molecule, before: Set<number>): string | null {
  const problem = validate(mol).find((item) => item.code === "valence" && item.atoms?.some((id) => !before.has(id)))
  return problem ? problem.message : null
}

export type EnumerateOptions = {
  /** Most molecules to build; the total is counted regardless. */
  limit?: number
  /** Let typical members stand in for each class (methyl, ethyl… for alkyl); else classes are left out. */
  representatives?: boolean
  /**
   * What makes two molecules the same compound (a canonical SMILES, say), for dropping
   * repeats: symmetric positions on a ring, or (R1)m where R1 = H gives the bare ring many
   * ways. Left out, every combination is kept. Kept here as a function so this package needs
   * no chemistry toolkit; null from it means "cannot tell", and the molecule is kept.
   */
  identity?: (mol: Molecule) => string | null
  /**
   * The same identity for a compound given as SMILES (an excluded compound of a proviso),
   * so it can be matched against what is built. Without it, such provisos cannot be checked.
   */
  identifySmiles?: (smiles: string) => string | null
}

/**
 * Expands a generic formula into concrete molecules: every count of each repeat unit
 * [ … ]n (written out head to tail), every placement of each variable attachment, and
 * every combination of each placeholder's choices that fit where it sits, each
 * placeholder choosing on its own. A class ("(C1-C30)alkyl") is never expanded in full; it
 * is left out, or with `representatives` a few typical members inside its range stand in
 * for it. The result says which, and what was skipped as not fitting.
 */
export function enumerate(drawing: Drawing, options: EnumerateOptions = {}): Enumeration {
  const steps = enumerateSteps(drawing, options)
  for (;;) {
    const step = steps.next()
    if (step.done) return step.value
  }
}

/**
 * enumerate() one step at a time, so a caller can spread the work out, show progress, or
 * stop early and keep what was made. It first lays out every attachment placement (one
 * step each), so `total` and the misfits are complete before any molecule is built, then
 * builds one combination per step. Every step yields the same result object, growing in
 * place: copy what you keep. The return value is exactly what enumerate() returns.
 */
export function* enumerateSteps(drawing: Drawing, { limit = 1000, representatives = false, identity, identifySmiles }: EnumerateOptions = {}): Generator<Enumeration, Enumeration> {
  /** The compounds made so far, by identity, when repeats are being dropped. */
  const seen = new Set<string>()
  const variables = drawing.variables ?? {}
  const defined = new Set(Object.keys(variables))
  const resolver = choiceResolver(variables, representatives)
  for (const { name } of placeholders(drawing)) resolver.choicesFor(name)
  const formulas = formulasOf(drawing)
  const result: Enumeration = {
    molecules: [],
    picks: [],
    total: 0,
    occupied: 0,
    classesLeftOut: resolver.classesLeftOut,
    represented: resolver.represented,
    misfits: resolver.misfits,
    undefinedNames: undefinedVariables(drawing),
    onlyClasses: [],
    failures: [],
    failed: 0,
    duplicates: 0,
    formulas: formulas.length,
    formulaOf: [],
    excluded: 0,
    uncheckedCompounds: 0,
    skippedRepeats: [],
  }
  const provisos = drawing.provisos ?? []
  const combinations = provisos.flatMap((proviso) => (proviso.kind === "combination" ? [proviso] : []))
  // Excluded compounds, by identity, when both identities are at hand.
  const compounds = provisos.flatMap((proviso) => (proviso.kind === "compound" ? [proviso.smiles] : []))
  const excludedKeys = new Set(identity && identifySmiles ? compounds.flatMap((smiles) => identifySmiles(smiles) ?? []) : [])
  result.uncheckedCompounds = compounds.length - excludedKeys.size
  const planning = planFormulas(drawing, formulas, resolver, result)
  let planned: { plans: Plan[]; unfilled: Set<string> }
  for (;;) {
    const step = planning.next()
    if (step.done) {
      planned = step.value
      break
    }
    yield result
  }
  const { plans, unfilled } = planned
  // Nothing at all could be laid out: only classes stand in the way.
  if (plans.length === 0 && unfilled.size > 0) return result

  const fail = (choice: Pick[], error: string) => {
    if (result.failed++ < 5) result.failures.push({ choice, error })
  }
  for (const { formula, layout, sites } of plans) {
    if ("error" in layout) {
      fail(layout.where, layout.error)
      continue
    }
    const laid = layout.drawing
    const strained = overValence(laid.molecule)
    for (const index of odometer(sites.map((site) => site.choices.length))) {
      if (result.molecules.length + result.failed >= limit) break
      const chosen = sites.map((site, at) => ({ site, choice: site.choices[index[at]] }))
      const picks: Pick[] = [...layout.where, ...chosen.flatMap(({ site, choice }) => [{ name: site.name, choice }, ...(resolver.inside.get(choice) ?? [])])]
      if (combinations.some((proviso) => excludedBy(proviso, picks))) {
        result.excluded++
        yield result
        continue
      }
      const built = applyOps({ ...laid, variables: undefined }, opsForAll(chosen))
      const wrong = built.ok ? (leftover(built.drawing.molecule, defined) ?? newlyOverValence(built.drawing.molecule, strained)) : built.error
      if (built.ok && !wrong) {
        const key = identity?.(built.drawing.molecule) ?? null
        if (key != null && excludedKeys.has(key)) result.excluded++
        else if (key != null && seen.has(key)) result.duplicates++
        else {
          if (key != null) seen.add(key)
          result.molecules.push(built.drawing.molecule)
          result.picks.push(picks)
          result.formulaOf.push(formula)
        }
      } else fail(picks, wrong!)
      yield result
    }
  }
  return result
}
