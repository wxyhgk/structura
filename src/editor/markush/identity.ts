import type { MainModule } from "@rdkit/rdkit"
import { toMolfile } from "@structura/core/molfile"
import type { Molecule } from "@structura/core/types"

/**
 * What makes two generated molecules the same compound: RDKit's canonical SMILES. A
 * molecule RDKit cannot read gives null, and is kept rather than merged.
 */
export function canonicalIdentity(rdkit: MainModule): (mol: Molecule) => string | null {
  return (mol) => {
    const read = rdkit.get_mol(toMolfile(mol))
    if (!read) return null
    try {
      return read.get_smiles()
    } finally {
      read.delete()
    }
  }
}
