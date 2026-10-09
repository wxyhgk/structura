import type { Drawing } from "@structura/core/types"
import type { ChoiceResolver } from "./choices.ts"
import { closeRing } from "./closures.ts"
import { layouts, type Layout } from "./layouts.ts"
import type { Site } from "./place.ts"
import { placeholders } from "./queries.ts"
import { repeatSkips, repeatVariants, type RepeatSkip } from "./repeats.ts"

/** A laid-out formula ready to build: which formula, its sites with the choices that fit, and how many combinations they make. */
export type Plan = { formula: number; layout: Exclude<Layout, { occupied: true }>; sites: Site[]; count: number }

/** The counts planning keeps up to date as it goes (an Enumeration has them all). */
export type Tally = { total: number; occupied: number; onlyClasses: string[]; skippedRepeats: RepeatSkip[] }

/** Every layout of a formula with each count of its repeat units, the counts first among the picks (they are settled first). */
function* countedLayouts(formula: Drawing): Generator<Layout> {
  for (const written of repeatVariants(formula)) {
    for (const layout of layouts(written.drawing)) yield "occupied" in layout ? layout : { ...layout, where: [...written.where, ...layout.where] }
  }
}

/**
 * Lays out every formula of a drawing, one attachment placement per step, and counts the
 * combinations each layout (as drawn, and with each ring closed) allows. Repeat units are
 * written out first, once for each count, and each of those is laid out in turn. Returns
 * the plans to build and the variables with nothing concrete, which stop their formula
 * altogether.
 */
export function* planFormulas(drawing: Drawing, formulas: Drawing[], resolver: ChoiceResolver, tally: Tally): Generator<void, { plans: Plan[]; unfilled: Set<string> }> {
  // Variables with nothing concrete: their formula cannot be expanded at all.
  const unfilled = new Set<string>()
  const plans: Plan[] = []
  for (const [index, formula] of formulas.entries()) {
    const top = new Set(placeholders(formula).map(({ name }) => name))
    const bare = [...top].filter((name) => resolver.choicesFor(name).length === 0)
    if (bare.length > 0) {
      for (const name of bare) unfilled.add(name)
      tally.onlyClasses = [...unfilled]
      continue
    }
    tally.skippedRepeats.push(...repeatSkips(formula))
    for (const layout of countedLayouts(formula)) {
      if ("occupied" in layout) {
        tally.occupied++
        yield
        continue
      }
      if ("error" in layout) {
        tally.total++
        plans.push({ formula: index + 1, layout, sites: [], count: 0 })
        yield
        continue
      }
      // Each way this layout can be: as drawn, and with each pair that may close a ring closed into each of its rings.
      const variants: Array<Exclude<Layout, { occupied: true } | { error: string }>> = [layout]
      for (const closure of drawing.ringClosures ?? []) {
        for (const ring of closure.ring) {
          if (ring.kind !== "fragment") continue
          const closed = closeRing(layout.drawing, closure, ring.molecule)
          if (closed) variants.push({ drawing: closed, where: [...layout.where, { name: `${closure.a}+${closure.b}`, choice: ring }] })
        }
      }
      for (const variant of variants) {
        const sites = resolver.sitesOf(variant.drawing, [])
        for (const site of sites) if (site.choices.length === 0) unfilled.add(site.name)
        const count = sites.reduce((product, site) => product * site.choices.length, 1)
        tally.total += count
        tally.onlyClasses = [...unfilled]
        plans.push({ formula: index + 1, layout: variant, sites, count })
      }
      yield
    }
  }
  return { plans, unfilled }
}
