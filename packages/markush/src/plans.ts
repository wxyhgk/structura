import type { Drawing } from "@structura/core/types"
import type { ChoiceResolver } from "./choices.ts"
import { closeRing } from "./closures.ts"
import { countUnit } from "./closed.ts"
import { layoutSpace, type Layout, type LayoutSpace } from "./layouts.ts"
import type { Pick } from "./picks.ts"
import type { Site } from "./place.ts"
import { placeholders } from "./queries.ts"
import { repeatSkips, repeatSpace, repeatStraddles, type RepeatSkip, type RepeatSpace, type RepeatStraddle } from "./repeats.ts"
import { stride } from "./sampling.ts"

/** A laid-out formula ready to build: which formula, its sites with the choices that fit, and how many combinations they make. */
export type Plan = { formula: number; layout: Exclude<Layout, { occupied: true }>; sites: Site[]; count: number }

/** The counts planning keeps up to date as it goes (an Enumeration has them all). */
export type Tally = { total: number; occupied: number; onlyClasses: string[]; skippedRepeats: RepeatSkip[]; straddlingAttachments: RepeatStraddle[]; estimated?: boolean }

/**
 * One formula with its repeat units written out one way (see repeatSpace), and the layouts
 * of its attachments (see layoutSpace): `size` of them, each reached by its index. Where the
 * layouts were counted without making them, `usable` leaves out the layouts with no room.
 */
export type Unit = { formula: number; variant: number; size: bigint; usable?: Set<number> }

/** More layouts than this are not made one by one just to be counted: a sample stands for them. */
const COUNTED_ONE_BY_ONE = 3000
/** How many layouts such a sample holds. */
const SAMPLE = 400
/** How many units' layout spaces are kept at hand. */
const OPEN_UNITS = 64

/**
 * The layouts of every formula of a drawing, never more than the one asked for at a time:
 * one attachment placement per layout (see layoutSpace), and for each the ways it can be
 * as drawn and with each pair that may close a ring closed into each of its rings.
 */
export type Planned = {
  units: Unit[]
  /** Variables with nothing concrete, which stop their formula altogether. */
  unfilled: Set<string>
  /** How many layouts there are in all (occupied ones included). */
  layouts: bigint
  /** The plans of one layout of a unit, or null when a candidate position has no room. */
  plansAt: (unit: Unit, index: bigint) => Plan[] | null
  /** Whether a layout is known to have room for all its pieces (without making it); false when it is known not to, true when that is not known. */
  roomAt: (unit: Unit, index: bigint) => boolean
}

/**
 * Plans every formula of a drawing, one attachment placement at a time where the layouts
 * have to be looked at one by one, and counts the combinations each layout (as drawn, and
 * with each ring closed) allows. Repeat units are written out first, once for each count,
 * and each of those is laid out in turn. Where the attachments are plain (see countUnit)
 * the layouts are counted without being made (`exact`: make every one, however many, to
 * count it: for checking the other). Returns the units to build from and the variables
 * with nothing concrete, which stop their formula altogether.
 */
export function* planFormulas(drawing: Drawing, formulas: Drawing[], resolver: ChoiceResolver, tally: Tally, { exact = false }: { exact?: boolean } = {}): Generator<void, Planned> {
  // Variables with nothing concrete: their formula cannot be expanded at all.
  const unfilled = new Set<string>()
  const units: Unit[] = []
  const spaces = new Map<number, RepeatSpace>()
  /** The units asked for lately: one is walked layout by layout, so its layout space serves many of them. */
  const open = new Map<string, { space: LayoutSpace; where: Pick[] }>()
  /** For the units counted without making their layouts, how to tell a layout with room from one without. */
  const roomy = new Map<string, (targets: number[][]) => boolean>()
  const opened = (unit: Unit) => {
    const key = `${unit.formula}:${unit.variant}`
    let held = open.get(key)
    if (!held) {
      const variant = spaces.get(unit.formula)!.at(unit.variant)
      if (open.size >= OPEN_UNITS) open.clear()
      open.set(key, (held = { space: layoutSpace(variant.drawing, unit.usable), where: variant.where }))
    }
    return held
  }
  const roomAt = (unit: Unit, index: bigint): boolean => {
    const fits = roomy.get(`${unit.formula}:${unit.variant}`)
    return fits ? fits(opened(unit).space.targets(index)) : true
  }
  const plansAt = (unit: Unit, index: bigint): Plan[] | null => {
    if (!roomAt(unit, index)) return null
    const { space, where } = opened(unit)
    const layout = space.at(index)
    if ("occupied" in layout) return null
    if ("error" in layout) return [{ formula: unit.formula, layout: { ...layout, where: [...where, ...layout.where] }, sites: [], count: 0 }]
    const laid = { ...layout, where: [...where, ...layout.where] }
    // Each way this layout can be: as drawn, and with each pair that may close a ring closed into each of its rings.
    const variants: Array<Exclude<Layout, { occupied: true } | { error: string }>> = [laid]
    for (const closure of drawing.ringClosures ?? []) {
      for (const ring of closure.ring) {
        if (ring.kind !== "fragment") continue
        const closed = closeRing(laid.drawing, closure, ring.molecule)
        if (closed) variants.push({ drawing: closed, where: [...laid.where, { name: `${closure.a}+${closure.b}`, choice: ring }] })
      }
    }
    return variants.map((variantLayout) => {
      const sites = resolver.sitesOf(variantLayout.drawing, [])
      return { formula: unit.formula, layout: variantLayout, sites, count: sites.reduce((product, site) => product * site.choices.length, 1) }
    })
  }
  /** Counts one layout into the tally, as the layouts are walked. */
  const count = (plans: Plan[] | null, weight = 1) => {
    if (!plans) return void (tally.occupied += Math.round(weight))
    for (const plan of plans) {
      if ("error" in plan.layout) {
        tally.total += Math.round(weight)
        continue
      }
      for (const site of plan.sites) if (site.choices.length === 0) unfilled.add(site.name)
      tally.total += Math.round(plan.count * weight)
      tally.onlyClasses = [...unfilled]
    }
  }
  let layouts = 0n
  for (const [index, formula] of formulas.entries()) {
    const top = new Set(placeholders(formula).map(({ name }) => name))
    const bare = [...top].filter((name) => resolver.choicesFor(name).length === 0)
    if (bare.length > 0) {
      for (const name of bare) unfilled.add(name)
      tally.onlyClasses = [...unfilled]
      continue
    }
    tally.skippedRepeats.push(...repeatSkips(formula))
    tally.straddlingAttachments.push(...repeatStraddles(formula))
    const written = repeatSpace(formula)
    spaces.set(index + 1, written)
    for (let variant = 0; variant < written.size; variant++) {
      const made = written.at(variant)
      const plain = !exact && (drawing.ringClosures?.length ?? 0) === 0 ? countUnit(made.drawing, resolver) : null
      const unit: Unit = { formula: index + 1, variant, size: 0n, ...(plain ? { usable: plain.usable } : {}) }
      unit.size = layoutSpace(made.drawing, unit.usable).size
      units.push(unit)
      layouts += unit.size
      if (plain) {
        tally.total += plain.combinations
        tally.occupied += plain.occupied
        tally.estimated ||= plain.estimated
        roomy.set(`${unit.formula}:${unit.variant}`, plain.fits)
        for (const name of plain.unfilled) unfilled.add(name)
        tally.onlyClasses = [...unfilled]
        yield
      } else if (exact || unit.size <= COUNTED_ONE_BY_ONE) {
        for (let at = 0n; at < unit.size; at++) {
          count(plansAt(unit, at))
          yield
        }
      } else {
        // Too many to make each: an even sample of them, scaled up.
        const taken = BigInt(SAMPLE)
        const weight = Number(unit.size) / SAMPLE
        const step = stride(unit.size)
        for (let at = 0n; at < taken; at++) {
          count(plansAt(unit, (at * step) % unit.size), weight)
          yield
        }
        tally.estimated = true
      }
    }
  }
  return { units, unfilled, layouts, plansAt, roomAt }
}
