import type { BondOrder } from "./types.ts"
import { ABBREVIATIONS } from "./templates/abbreviations.ts"

/**
 * An abbreviation such as Ph or Boc, laid out by RDKit ahead of time. atoms[0] is the
 * anchor, which sits at the origin; every attachment bond leaves the anchor, and the
 * first one points left along -x. Coordinates are editor pixels.
 */
export type GroupTemplate = {
  label: string
  synonyms: string[]
  /** How the label reads when the group hangs off the left end of a bond, such as MeO. */
  labelLeft?: string
  attachments: number
  /** Hill formula of the group itself, with any net charge, for example C6H5. */
  formula: string
  atoms: Array<{ el: string; x: number; y: number; charge?: number; isotope?: number }>
  bonds: Array<[number, number, BondOrder]>
}

/**
 * Typed labels that mean the group even though they are also element symbols. Actinium,
 * tennessine and praseodymium stay reachable from the periodic table.
 */
export const GROUP_FIRST = new Set(["Ac", "Ts", "Pr"])

/**
 * The few abbreviations common enough to stay as a label. Any other abbreviation is a
 * shortcut for typing: it draws the real atoms and leaves no group behind, so the
 * structure is not hidden behind names.
 */
const KEPT_AS_LABEL = new Set(["Me", "Et", "iPr", "tBu", "Ph", "Bn", "Ac", "Bz", "Boc", "Cbz", "Fmoc", "Ts", "TBS", "TMS"])

export function keptAsLabel(template: GroupTemplate): boolean {
  return KEPT_AS_LABEL.has(template.label)
}

const byName = new Map<string, GroupTemplate>()
for (const template of ABBREVIATIONS) {
  for (const name of [template.label, ...template.synonyms]) {
    if (!byName.has(name)) byName.set(name, template)
  }
}

/** Case-sensitive, so CO (carbonyl) and Co (cobalt) stay apart. */
export function templateFor(text: string): GroupTemplate | undefined {
  return byName.get(text)
}

export function allTemplates(): readonly GroupTemplate[] {
  return ABBREVIATIONS
}
