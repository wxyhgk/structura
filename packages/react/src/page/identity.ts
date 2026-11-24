import type { MainModule } from "@rdkit/rdkit"
import { toMolfile } from "@structura/core/molfile"
import type { Molecule } from "@structura/core/types"

/** The same identity for a compound given as SMILES (a proviso's excluded compound); null if RDKit cannot read it. */
export function canonicalSmiles(rdkit: MainModule): (smiles: string) => string | null {
  return (smiles) => {
    const read = rdkit.get_mol(smiles)
    if (!read) return null
    try {
      return read.get_smiles()
    } finally {
      read.delete()
    }
  }
}

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
