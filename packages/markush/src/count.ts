import type { Choice, Drawing } from "@structura/core/types"
import { choiceResolver } from "./choices.ts"
import { formulasOf } from "./formulas.ts"
import { planFormulas, type Tally } from "./plans.ts"
import { placeholders } from "./queries.ts"

/** How big a generic formula's library is, known before any compound is built. */
export type LibrarySize = {
  /** Combinations: every placement of each attachment times every fitting choice at each placeholder (repeats not yet dropped). */
  combinations: number
  /** Per variable, the typical members that stand in for its classes (a class itself is wider). */
  represented: Record<string, Choice[]>
  /** Per variable, how many classes were not counted at all (with representatives off). */
  classesLeftOut: Record<string, number>
  /** Variables with nothing concrete to count: the library cannot be listed until they have. */
  onlyClasses: string[]
}

/**
 * Counts what enumerate() would make, without making it: every attachment is laid out and
 * every placeholder's fitting choices are counted, and no molecule is built.
 */
export function librarySize(drawing: Drawing, { representatives = true }: { representatives?: boolean } = {}): LibrarySize {
  const resolver = choiceResolver(drawing.variables ?? {}, representatives)
  for (const { name } of placeholders(drawing)) resolver.choicesFor(name)
  const tally: Tally = { total: 0, occupied: 0, onlyClasses: [] }
  const planning = planFormulas(drawing, formulasOf(drawing), resolver, tally)
  while (!planning.next().done);
  return { combinations: tally.total, represented: resolver.represented, classesLeftOut: resolver.classesLeftOut, onlyClasses: tally.onlyClasses }
}
