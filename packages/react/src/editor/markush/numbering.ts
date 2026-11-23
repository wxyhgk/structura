import type { Molecule } from "@structura/core/types"
import { assignNumbers, DEFAULT_NUMBERING as DEFAULT, type CompoundNumbering } from "@structura/markush"
import { compoundFields } from "@structura/markush"
import type { Row } from "./results.ts"

/**
 * How generated compounds are numbered, as a patent numbers them: a pattern with {n} where
 * the number goes ("C-{n}" → C-1, C-2…; "化合物{n}"; "1-{n}"), counting from `start`. Without
 * {n}, the number follows the pattern. Which compound has which number is kept in the
 * document (CompoundNumbering): see numberByBook.
 */
export type Numbering = { pattern: string; start: number }

export const DEFAULT_NUMBERING: Numbering = { pattern: DEFAULT.pattern, start: DEFAULT.start }

/** The compound number `n` as the pattern writes it. */
export function numberText(pattern: string, n: number): string {
  const text = pattern.trim() || DEFAULT_NUMBERING.pattern
  return text.includes("{n}") ? text.replaceAll("{n}", String(n)) : `${text}${n}`
}

/** The number of the compound at `index` (0-based) of a list numbered in its order. */
export function compoundId(numbering: Numbering, index: number): string {
  const start = Number.isFinite(numbering.start) ? Math.trunc(numbering.start) : DEFAULT_NUMBERING.start
  return numberText(numbering.pattern, start + index)
}

/** The rows numbered in their order, from the start, with nothing remembered (see numberByBook for the document's numbers). */
export function numberRows(rows: readonly Row[], numbering: Numbering): Row[] {
  return rows.map((row, index) => ({ ...row, id: compoundId(numbering, index) }))
}

/**
 * What a compound is called in the numbering book: "s:" and its canonical SMILES; or, when
 * `smiles` cannot say (no RDKit, repeats kept, a molecule it cannot read), "p:" and its
 * formula number and what each variable became. The second is the same for the same choices,
 * but changes when a candidate is edited (a piece's name, a class's range), so it is the
 * less stable of the two.
 */
export function rowKey(row: Row, smiles: ((mol: Molecule) => string | null) | undefined): string {
  const identity = smiles?.(row.mol)
  if (identity) return `s:${identity}`
  const fields = compoundFields(row.picks, row.formula)
  return `p:${Object.keys(fields).sort().map((name) => `${name}=${fields[name]}`).join("|")}`
}

/** One key for each row, in order; a second compound with the same key (repeats kept) gets "#2", "#3"… so no two share a number. */
export function rowKeys(rows: readonly Row[], smiles?: (mol: Molecule) => string | null): string[] {
  const seen = new Map<string, number>()
  return rows.map((row) => {
    const key = rowKey(row, smiles)
    const times = (seen.get(key) ?? 0) + 1
    seen.set(key, times)
    return times > 1 ? `${key}#${times}` : key
  })
}

/**
 * The rows with the numbers the book gives them: a compound it has met keeps its number,
 * new ones follow the highest given out, in list order (what assign_numbers will write, so
 * what is shown is what is saved). `fresh` is how many have no number in the book yet.
 */
export function numberByBook(rows: readonly Row[], keys: readonly string[], book: CompoundNumbering): { rows: Row[]; fresh: number } {
  const after = assignNumbers(book, keys).assigned ?? {}
  const had = book.assigned ?? {}
  let fresh = 0
  for (const key of keys) if (!Object.hasOwn(had, key)) fresh++
  return { rows: rows.map((row, index) => ({ ...row, id: numberText(book.pattern, after[keys[index]]) })), fresh }
}
