import { toSdf } from "@structura/core/molfile"
import type { Enumeration } from "./enumerate.ts"
import { pickFields, type Pick } from "./picks.ts"

// What an enumeration writes out: one compound's data items, and the SD file of them all.
// The editor's download and the host page's handle both use these, so they write the same.

/**
 * One generated compound's fields, as SD data items and CSV columns: which formula it came
 * from first (when the drawing holds several), then what each variable became.
 */
export function compoundFields(picks: readonly Pick[], formula?: number): Record<string, string> {
  return { ...(formula != null ? { "Formula No": String(formula) } : {}), ...pickFields(picks) }
}

/** Each compound's fields, in the enumeration's order. */
export function enumerationFields(result: Enumeration): Record<string, string>[] {
  return result.picks.map((picks, index) => compoundFields(picks, result.formulas > 1 ? result.formulaOf[index] : undefined))
}

/** The enumeration's compounds as an SD file, each record carrying its fields. */
export function enumerationSdf(result: Enumeration): string {
  return toSdf(result.molecules, "Structura", enumerationFields(result))
}
