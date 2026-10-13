import type { Row } from "./results.ts"

/**
 * How generated compounds are numbered, as a patent numbers them: a pattern with {n} where
 * the number goes ("C-{n}" → C-1, C-2…; "化合物{n}"; "1-{n}"), counting from `start`. Without
 * {n}, the number follows the pattern.
 */
export type Numbering = { pattern: string; start: number }

export const DEFAULT_NUMBERING: Numbering = { pattern: "C-{n}", start: 1 }

/** The number of the compound at `index` (0-based) of the list being numbered. */
export function compoundId(numbering: Numbering, index: number): string {
  const start = Number.isFinite(numbering.start) ? Math.trunc(numbering.start) : DEFAULT_NUMBERING.start
  const n = String(start + index)
  const pattern = numbering.pattern.trim() || DEFAULT_NUMBERING.pattern
  return pattern.includes("{n}") ? pattern.replaceAll("{n}", n) : `${pattern}${n}`
}

/** The rows numbered in their order: what is shown is what is exported, filtered or not. */
export function numberRows(rows: readonly Row[], numbering: Numbering): Row[] {
  return rows.map((row, index) => ({ ...row, id: compoundId(numbering, index) }))
}
