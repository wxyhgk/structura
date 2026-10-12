import { usableRecords } from "@structura/core/import"
import type { Molecule } from "@structura/core/types"
import { smilesLines, smilesRecords } from "@structura/rdkit"
import { loadRDKit } from "../rdkit.ts"
import { importNotes } from "./notes.ts"

/**
 * The molecules of SMILES text (one per line, a name after a space allowed), laid out by
 * RDKit, and one line per problem for the user. Kept apart from read.ts, which the editor-free
 * chem-structura/core uses: this one fetches RDKit.
 */
export async function readSmiles(text: string): Promise<{ molecules: Molecule[]; lines: string[] }> {
  if (smilesLines(text).length === 0) return { molecules: [], lines: ["没有找到 SMILES。"] }
  const records = smilesRecords(await loadRDKit(), text)
  const imported = usableRecords(records)
  const lines = importNotes(records, imported.problems)
  return { molecules: imported.molecules, lines: imported.molecules.length > 0 || lines.length > 0 ? lines : ["SMILES 里没有可以读取的分子。"] }
}
