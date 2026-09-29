import { usableRecords } from "@/chem/import"
import { readSdf } from "@/chem/sdf"
import type { Molecule } from "@/chem/types"
import { importNotes } from "@/editor/imports/notes"

/**
 * The molecules in molfile or SD text that the editor can hold, and one line per problem
 * for the user. Throws only when the text cannot be read at all.
 */
export function readMolText(text: string): { molecules: Molecule[]; lines: string[] } {
  const records = readSdf(text)
  const imported = usableRecords(records)
  return { molecules: imported.molecules, lines: importNotes(records, imported.problems) }
}

/** Molecules to start the editor with; text that cannot be read starts it empty. */
export function initialMolecules(text: string | undefined): Molecule[] {
  if (!text?.trim()) return []
  try {
    return readMolText(text).molecules
  } catch {
    return []
  }
}
