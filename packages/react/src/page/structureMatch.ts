import type { MainModule, Mol } from "@rdkit/rdkit"
import { toMolfile } from "@structura/core/molfile"
import type { Molecule } from "@structura/core/types"

// Whether a generated compound contains a structure given as SMILES or SMARTS, by RDKit.

/** The query RDKit reads from the text (SMARTS, which takes plain SMILES too); null when it is neither. Delete it when done. */
export function readQuery(rdkit: MainModule, text: string): Mol | null {
  try {
    return rdkit.get_qmol(text)
  } catch {
    return null
  }
}

/** Whether `mol` contains the query; null when RDKit cannot read the molecule. */
export function containsQuery(rdkit: MainModule, query: Mol, mol: Molecule): boolean | null {
  try {
    const read = rdkit.get_mol(toMolfile(mol))
    if (!read) return null
    try {
      const match = JSON.parse(read.get_substruct_match(query)) as { atoms?: unknown[] }
      return (match.atoms?.length ?? 0) > 0
    } finally {
      read.delete()
    }
  } catch {
    return null
  }
}
