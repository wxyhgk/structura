import { useMemo } from "react"
import type { CompoundNumbering } from "@structura/markush"
import type { Drawing } from "@structura/core/types"
import type { Op } from "@structura/core/ops"
import type { Run } from "@structura/engine"
import { canonicalIdentity } from "../identity.ts"
import { numberByBook, rowKeys, type Numbering } from "../numbering.ts"
import type { Row } from "../results.ts"
import { useRdkit } from "./useRdkit.ts"

const KEEP = { keepSelection: true }

/**
 * The compound numbers of the generated rows, from the numbering the document keeps: a
 * compound keeps the number it was given, new ones follow the highest, a compound no longer
 * generated keeps its number taken. What is shown is only a preview until it is fixed (pin):
 * fixing writes the numbers into the document as one undoable step, and is done when the
 * list is exported and on request, so that opening a file or generating changes nothing.
 *
 * `bySmiles` is whether compounds are told apart by canonical SMILES (repeats are dropped,
 * RDKit is there); otherwise by what each variable became, which numbers less stably.
 * `fallback` is how numbers are written until the document says (this browser's habit).
 */
export function useNumbering({ drawing, run, rows, bySmiles, fallback }: { drawing: Drawing; run: Run; rows: readonly Row[]; bySmiles: boolean; fallback: Numbering }) {
  const loaded = useRdkit(bySmiles).rdkit
  const rdkit = bySmiles ? loaded : null
  const book: CompoundNumbering = drawing.numbering ?? fallback
  const waiting = bySmiles && !rdkit
  const keys = useMemo(() => rowKeys(rows, rdkit ? canonicalIdentity(rdkit) : undefined), [rows, rdkit])
  const numbered = useMemo(() => (waiting ? { rows: rows.slice(), fresh: 0 } : numberByBook(rows, keys, book)), [waiting, rows, keys, book])

  /** What writes the numbering's format into the document when it does not have one yet, then the ops that follow. */
  const write = (...ops: Op[]) => void run([...(drawing.numbering ? [] : [{ op: "set_numbering", pattern: book.pattern, start: book.start } as const]), ...ops], KEEP)

  return {
    /** The rows with their numbers (as numbered so far, and as the new ones would be). */
    rows: numbered.rows,
    numbering: { pattern: book.pattern, start: book.start } as Numbering,
    /** How many compounds the document has given a number, listed now or not. */
    taken: Object.keys(book.assigned ?? {}).length,
    /** How many of the listed compounds have no number in the document yet. */
    fresh: numbered.fresh,
    /** Compounds are told apart by what each variable became: editing a candidate may renumber the new ones. */
    unstable: !bySmiles,
    /** Writes how numbers are written (and keeps it as this browser's habit for documents without it). */
    setNumbering(next: Numbering) {
      run([{ op: "set_numbering", pattern: next.pattern, start: next.start }], KEEP)
    },
    /** Writes the numbers shown into the document, if any are new, and returns the rows as numbered. */
    pin(): Row[] {
      if (!waiting && (numbered.fresh > 0 || !drawing.numbering)) write({ op: "assign_numbers", keys })
      return numbered.rows
    },
    /** Takes every number back and numbers the listed compounds again from the first, as one step. */
    renumber() {
      if (!waiting) write({ op: "clear_numbers" }, { op: "assign_numbers", keys })
    },
  }
}
