import type { MainModule } from "@rdkit/rdkit"
import { emptyMolecule } from "@structura/core/molecule"
import { readMolfile, type MolRecord } from "@structura/core/sdf"
import { smilesLines, smilesToMolfile } from "./smiles.ts"

/**
 * SMILES text (one per line, optionally named) as records, the way an SD file reads: each
 * keeps its name, or its SMILES when it has none. A SMILES RDKit cannot read becomes an
 * empty record carrying the error, so core's usableRecords leaves it out and says why.
 */
export function smilesRecords(rdkit: MainModule, text: string): MolRecord[] {
  return smilesLines(text).map(({ smiles, name }) => {
    const result = smilesToMolfile(rdkit, smiles)
    if ("error" in result) {
      return { mol: emptyMolecule(), title: smiles, properties: {}, problems: [{ code: "bad-molfile", severity: "error", message: result.error }] }
    }
    const read = readMolfile(result.molfile)
    return { mol: read.mol, title: name || smiles, properties: {}, problems: read.problems }
  })
}
