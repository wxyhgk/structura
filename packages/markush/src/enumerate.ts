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
import { planFormulas, type Plan, type Planned, type Unit } from "./plans.ts"
import { stride } from "./sampling.ts"
import { excludedBy } from "./provisos.ts"
import { placeholders, undefinedVariables } from "./queries.ts"
import type { RepeatSkip, RepeatStraddle } from "./repeats.ts"

export type Enumeration = {
  /** Concrete molecules, in order, at most `limit` of them. */
  molecules: Molecule[]
  /** For each molecule, what each variable became and where each attachment went. */
  picks: Pick[][]
  /** How many combinations the fitting choices allow, generated or not. */
  total: number
  /** Whether `total` and `occupied` are estimates: too many layouts (or too many shared positions) to count them all exactly. */
  estimated?: boolean
  /**
   * How the combinations were picked when there were more than `limit`: "first" for the
   * first ones in order, "spread" for ones spaced evenly over all of them. "first" too when
   * all of them were made.
   */
  order?: "first" | "spread"
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
  /** Variable attachments across a repeat unit's brackets: made once, as drawn, not with every copy. */
  straddlingAttachments: RepeatStraddle[]
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

/** One generated compound, as handed to `onCompound`. */
export type Compound = { mol: Molecule; picks: Pick[]; formula: number }

export type EnumerateOptions = {
  /** Most molecules to build (Infinity: all of them); the total is counted regardless. */
  limit?: number
  /**
   * Which combinations to build when there are more than `limit`. "first" (the default): the
   * first ones, in order, which leaves the variables written first on their first choice
   * (the last one turns fastest). "spread": ones spaced evenly over every combination, every
   * attachment placement and repeat count included, so each variable goes through its
   * choices; the compounds come out in the order they would have in "first". Combinations
   * left out as repeats or by a proviso are replaced by further ones, up to a few times
   * `limit` of them are tried.
   */
  order?: "first" | "spread"
  /**
   * Called with each compound as it is made, instead of keeping it in the result (whose
   * `molecules` then stay empty): for writing out a library too big to hold. Repeats are
   * still dropped, which keeps one identity for each compound made.
   */
  onCompound?: (compound: Compound) => void
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
 * stop early and keep what was made. It first counts the layouts of the attachments (one
 * step for each formula and repeat count, or one for each layout where they cannot be
 * counted at once), so `total` and the misfits are complete before any molecule is built,
 * then builds one combination per step. Every step yields the same result object, growing in
 * place: copy what you keep. The return value is exactly what enumerate() returns.
 */
export function* enumerateSteps(drawing: Drawing, { limit = 1000, representatives = false, identity, identifySmiles, order = "first", onCompound }: EnumerateOptions = {}): Generator<Enumeration, Enumeration> {
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
    estimated: false,
    order: "first",
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
    straddlingAttachments: [],
  }
  const provisos = drawing.provisos ?? []
  const combinations = provisos.flatMap((proviso) => (proviso.kind === "combination" ? [proviso] : []))
  // Excluded compounds, by identity, when both identities are at hand.
  const compounds = provisos.flatMap((proviso) => (proviso.kind === "compound" ? [proviso.smiles] : []))
  const excludedKeys = new Set(identity && identifySmiles ? compounds.flatMap((smiles) => identifySmiles(smiles) ?? []) : [])
  result.uncheckedCompounds = compounds.length - excludedKeys.size
  const planning = planFormulas(drawing, formulas, resolver, result)
  let planned: Planned
  for (;;) {
    const step = planning.next()
    if (step.done) {
      planned = step.value
      break
    }
    yield result
  }
  const { units, unfilled, layouts, plansAt, roomAt } = planned
  // Nothing at all could be laid out: only classes stand in the way.
  if (units.length === 0 && unfilled.size > 0) return result

  const fail = (choice: Pick[], error: string) => {
    if (result.failed++ < 5) result.failures.push({ choice, error })
  }
  /** Compounds kept so far (handed on or held), and whether there are enough. */
  let kept = 0
  const done = () => kept + result.failed >= limit
  /** Builds one combination of a plan (`index`: which choice at each of its sites), or says why it leaves none. */
  const attempt = (plan: Plan, strained: Set<number>, index: number[]): boolean => {
    const { formula, layout, sites } = plan
    const laid = (layout as { drawing: Drawing }).drawing
    const chosen = sites.map((site, at) => ({ site, choice: site.choices[index[at]] }))
    const picks: Pick[] = [...layout.where, ...chosen.flatMap(({ site, choice }) => [{ name: site.name, choice }, ...(resolver.inside.get(choice) ?? [])])]
    if (combinations.some((proviso) => excludedBy(proviso, picks))) {
      result.excluded++
      return false
    }
    const built = applyOps({ ...laid, variables: undefined }, opsForAll(chosen))
    const wrong = built.ok ? (leftover(built.drawing.molecule, defined) ?? newlyOverValence(built.drawing.molecule, strained)) : built.error
    if (built.ok && !wrong) {
      const key = identity?.(built.drawing.molecule) ?? null
      if (key != null && excludedKeys.has(key)) result.excluded++
      else if (key != null && seen.has(key)) result.duplicates++
      else {
        if (key != null) seen.add(key)
        kept++
        if (onCompound) onCompound({ mol: built.drawing.molecule, picks, formula })
        else {
          result.molecules.push(built.drawing.molecule)
          result.picks.push(picks)
          result.formulaOf.push(formula)
        }
        return true
      }
    } else fail(picks, wrong!)
    return false
  }

  /**
   * Visits layouts in a scattered order (see stride), evenly over all of them, and takes one
   * combination from each, another each time round once every layout has been visited. The
   * combination is picked by the visit's place the same way, over the combinations of that
   * layout. Visits that bring nothing (occupied, a repeat, a proviso) are replaced, to a limit.
   */
  const spreadOut = function* (): Generator<Enumeration, void> {
    const starts: bigint[] = []
    let from = 0n
    for (const unit of units) {
      starts.push(from)
      from += unit.size
    }
    const locate = (layout: bigint): { unit: Unit; at: bigint } => {
      let index = starts.length - 1
      while (starts[index] > layout) index--
      return { unit: units[index], at: layout - starts[index] }
    }
    const step = stride(layouts)
    const visited = new Set<string>()
    /** Where each kept compound came from, to put them back in order at the end. */
    const places: Array<[bigint, bigint]> = []
    const tries = Math.max(limit * 4, limit + 100)
    /** Layouts passed over for want of room cost next to nothing, but not nothing. */
    const passes = tries * 100
    for (let visit = 0n, tried = 0, passed = 0; tried < tries && passed < passes && !done(); visit++) {
      const layout = (visit * step) % layouts
      const { unit, at } = locate(layout)
      if (!roomAt(unit, at)) {
        if (++passed % 1000 === 0) yield result
        continue
      }
      tried++
      const plans = plansAt(unit, at)
      yield result
      if (!plans) continue
      const sizes = plans.map((plan) => ("error" in plan.layout ? 1n : plan.sites.reduce((product, site) => product * BigInt(site.choices.length), 1n)))
      const all = sizes.reduce((sum, size) => sum + size, 0n)
      if (all === 0n) continue
      // Another combination of this layout each time round, a different one to start from for each layout.
      const start = (((layout + 1n) * 0x9e3779b97f4a7c15n) >> 20n) % all
      const which = (start + (visit / layouts) * stride(all)) % all
      const key = `${layout}:${which}`
      if (visited.has(key)) continue
      visited.add(key)
      let rest = which
      let found = 0
      while (rest >= sizes[found]) rest -= sizes[found++]
      const plan = plans[found]
      if ("error" in plan.layout) {
        fail(plan.layout.where, plan.layout.error)
        continue
      }
      const index: number[] = []
      for (let site = plan.sites.length - 1; site >= 0; site--) {
        const choices = BigInt(plan.sites[site].choices.length)
        index[site] = Number(rest % choices)
        rest /= choices
      }
      if (attempt(plan, overValence(plan.layout.drawing.molecule), index)) places.push([layout, which])
    }
    // The compounds in the order of the layouts and combinations they came from.
    const sorted = places.map((place, position) => ({ place, position })).sort((a, b) => (a.place[0] === b.place[0] ? (a.place[1] < b.place[1] ? -1 : 1) : a.place[0] < b.place[0] ? -1 : 1))
    if (!onCompound) {
      const [molecules, picks, formulaOf] = [result.molecules.slice(), result.picks.slice(), result.formulaOf.slice()]
      for (const [to, { position }] of sorted.entries()) {
        result.molecules[to] = molecules[position]
        result.picks[to] = picks[position]
        result.formulaOf[to] = formulaOf[position]
      }
    }
  }

  if (order === "spread" && result.total > limit && layouts > 0n) {
    result.order = "spread"
    yield* spreadOut()
  } else {
    // In order: each layout of each unit, and each combination of its plans, the last site turning fastest.
    for (const unit of units) {
      for (let at = 0n; at < unit.size && !done(); at++) {
        const plans = plansAt(unit, at)
        if (!plans) {
          yield result
          continue
        }
        for (const plan of plans) {
          if ("error" in plan.layout) {
            fail(plan.layout.where, plan.layout.error)
            continue
          }
          const strained = overValence(plan.layout.drawing.molecule)
          for (const index of odometer(plan.sites.map((site) => site.choices.length))) {
            if (done()) break
            attempt(plan, strained, index)
            yield result
          }
        }
      }
    }
  }
  return result
}
