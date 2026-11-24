import { enumerateSteps, type EnumerateOptions } from "@structura/markush"
import type { Drawing, Molecule } from "@structura/core/types"
import { sdfOf } from "./exportRows.ts"
import { compoundId, type Numbering } from "./numbering.ts"
import { CSV_BOM, csvHead, csvLine, rowFields, type Row } from "./results.ts"
import { runSlice } from "./slice.ts"
import { SLICE_MS } from "./asyncSlices.ts"

// The whole library written to a file, as it is generated: nothing is kept but the lines
// already written, so a library too big to list on the page can still be exported.

/** How often the progress is reported. */
const REPORT_MS = 150
/** SD records put together at a time. */
const BATCH = 200
/** Most compounds one file holds: the lines written (and the identities of the compounds made, when repeats are dropped) are kept in memory until the file is done. */
export const EXPORT_CAP = 1_000_000
/** From this many combinations on, the user is asked before the export starts. */
export const CONFIRM_ABOVE = 100_000

export type ExportAllKind = "csv" | "sdf"

export const EXPORT_TYPES: Record<ExportAllKind, { extension: string; type: string }> = {
  csv: { extension: "csv", type: "text/csv" },
  sdf: { extension: "sdf", type: "chemical/x-mdl-sdfile" },
}

export type ExportAllProgress = {
  /** Combinations dealt with so far (written, repeats, excluded, failed), of `total` (the whole library). */
  tried: number
  total: number
  /** Compounds written. */
  written: number
}

export type ExportAllOutcome =
  | { cancelled: true }
  | {
      cancelled: false
      file: Blob
      written: number
      /** Compounds left out as repeats of one written (when asked), excluded by a proviso, or that could not be built. */
      duplicates: number
      excluded: number
      failed: number
      /** Whether the file stops at EXPORT_CAP compounds, with more still to come. */
      capped: boolean
    }

/**
 * Writes every compound of `drawing` to one CSV or SD file, in the order of the generated
 * list (see enumerate, order "first") and with the same columns and fields as a download
 * of that list. Work is done in slices, with a pause between them (`pause`) so the page stays
 * usable; `signal` cancels it. `identities` drops repeats of a compound already written (a
 * set of the compounds' canonical SMILES, kept in memory), and `smiles` writes a CSV's SMILES column.
 */
export async function exportAll(
  drawing: Drawing,
  {
    kind,
    representatives,
    identities,
    smiles,
    numbering,
    numberOf,
    signal,
    onProgress,
    pause = () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
    cap = EXPORT_CAP,
  }: {
    kind: ExportAllKind
    representatives: boolean
    identities?: Pick<EnumerateOptions, "identity" | "identifySmiles">
    smiles: (mol: Molecule) => string | null
    numbering: Numbering
    /**
     * The number a compound is written with, from the document's numbers (its canonical SMILES
     * when repeats are dropped, else null); without it, compounds are numbered as they come.
     */
    numberOf?: (row: Row, identity: string | null) => string
    signal?: AbortSignal
    onProgress?: (progress: ExportAllProgress) => void
    pause?: () => Promise<void>
    cap?: number
  },
): Promise<ExportAllOutcome> {
  // The identity of a compound is its canonical SMILES: the one just worked out for dropping repeats is the SMILES column.
  let latest: { mol: Molecule; key: string | null } | null = null
  const identity = identities?.identity
  const remember = identity ? (mol: Molecule) => (latest = { mol, key: identity(mol) }).key : undefined
  const smilesOf = (mol: Molecule) => (latest?.mol === mol ? latest.key : smiles(mol)) ?? ""

  let written = 0
  let formulas = 1
  const columns: string[] = []
  /** CSV: each line with the number of columns it was written for (columns found later are empty in it). */
  const lines: string[] = []
  const widths: number[] = []
  const records: string[] = []
  let batch: Row[] = []
  const add = ({ mol, picks, formula }: { mol: Molecule; picks: Row["picks"]; formula: number }) => {
    const row: Row = { number: written + 1, mol, picks, ...(formulas > 1 ? { formula } : {}), id: compoundId(numbering, written) }
    if (numberOf) row.id = numberOf(row, latest?.mol === mol ? latest.key : null)
    written++
    if (kind === "sdf") {
      batch.push(row)
      if (batch.length >= BATCH) {
        records.push(sdfOf(batch))
        batch = []
      }
      return
    }
    for (const name of Object.keys(rowFields(row))) if (!columns.includes(name)) columns.push(name)
    lines.push(csvLine(row, columns, smilesOf))
    widths.push(columns.length)
  }

  const steps = enumerateSteps(drawing, { limit: Infinity, representatives, identity: remember, identifySmiles: identities?.identifySmiles, onCompound: add })
  let reported = 0
  let capped = false
  let result = null as ReturnType<typeof steps.next>["value"] | null
  for (;;) {
    const end = performance.now() + SLICE_MS
    const slice = runSlice(steps, () => performance.now() < end && written < cap)
    if (slice.error != null) throw new Error(slice.error)
    result = slice.step.value
    formulas = result.formulas
    if (slice.step.done) break
    if (written >= cap) {
      steps.return(result)
      capped = true
      break
    }
    if (signal?.aborted) {
      steps.return(result)
      return { cancelled: true }
    }
    const now = performance.now()
    if (onProgress && now - reported >= REPORT_MS) {
      reported = now
      onProgress({ tried: written + result.duplicates + result.excluded + result.failed, total: result.total, written })
    }
    await pause()
  }
  if (signal?.aborted) return { cancelled: true }
  const { type } = EXPORT_TYPES[kind]
  if (kind === "sdf") {
    if (batch.length > 0) records.push(sdfOf(batch))
    return { cancelled: false, file: new Blob(records, { type }), written, duplicates: result.duplicates, excluded: result.excluded, failed: result.failed, capped }
  }
  // Lines written before a column was found are padded with its empty cells.
  const body = lines.map((line, index) => line + ",".repeat(columns.length - widths[index]))
  const pieces: string[] = [`${CSV_BOM}${csvHead(columns)}\n`]
  for (let from = 0; from < body.length; from += 5000) pieces.push(`${body.slice(from, from + 5000).join("\n")}\n`)
  return { cancelled: false, file: new Blob(pieces, { type }), written, duplicates: result.duplicates, excluded: result.excluded, failed: result.failed, capped }
}
