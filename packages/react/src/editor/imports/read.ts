import { usableRecords } from "@structura/core/import"
import { readSdf } from "@structura/core/sdf"
import { readDocument } from "@structura/core/document"
import type { Bracket, Drawing, Molecule } from "@structura/core/types"
import { importNotes } from "./notes.ts"

/**
 * The molecules in molfile or SD text that the editor can hold (with each one's brackets,
 * from its Sgroups), and one line per problem for the user. Throws only when the text
 * cannot be read at all.
 */
export function readMolText(text: string): { molecules: Molecule[]; brackets: Array<Bracket[] | undefined>; lines: string[] } {
  const records = readSdf(text)
  const imported = usableRecords(records)
  return { molecules: imported.molecules, brackets: imported.brackets, lines: importNotes(records, imported.problems) }
}

/** Molecules to start the editor with; text that cannot be read starts it empty. */
/**
 * What an embedded editor starts with: a Structura document (with its generic formula) if
 * one is given and readable, else the molecules in molfile or SD text, else nothing.
 */
export function initialContent(document: string | undefined, molfile: string | undefined): Molecule[] | Drawing {
  if (document?.trim()) {
    const read = readDocument(document)
    if ("drawing" in read) return read.drawing
    console.warn(`initialDocument could not be read: ${read.error}`)
  }
  return initialMolecules(molfile)
}

export function initialMolecules(text: string | undefined): Molecule[] {
  if (!text?.trim()) return []
  try {
    return readMolText(text).molecules
  } catch {
    return []
  }
}
