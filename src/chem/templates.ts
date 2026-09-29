import { ABBREVIATIONS } from "./templates/abbreviations.ts"
import type { GroupTemplate } from "./templates/types.ts"

export type { GroupTemplate }

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
