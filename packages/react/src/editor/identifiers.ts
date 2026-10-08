import { toMolfile } from "@structura/core/molfile"
import { subMolecule } from "@structura/core/molecule"
import type { Molecule } from "@structura/core/types"
import { isVariableName } from "@structura/markush"
import { loadRDKit } from "./rdkit.ts"

/** The text identifiers chemists paste into databases and notebooks. */
export type IdentifierKind = "smiles" | "inchi" | "inchikey"

export const IDENTIFIER_NAMES: Record<IdentifierKind, string> = { smiles: "SMILES", inchi: "InChI", inchikey: "InChIKey" }

/**
 * The atoms' SMILES, InChI or InChIKey, from RDKit (loaded on first use). Placeholders such
 * as R1 come out as "*" in SMILES; InChI has no way to say them, so it refuses then.
 */
export async function identifierOf(mol: Molecule, atomIds: number[], kind: IdentifierKind): Promise<string> {
  const rdkit = await loadRDKit()
  const piece = atomIds.length > 0 ? subMolecule(mol, atomIds) : mol
  if (kind !== "smiles" && piece.atoms.some((atom) => atom.alias && isVariableName(atom.alias))) {
    throw new Error("含有 R1、X 这类变量，InChI 表示不了")
  }
  const read = rdkit.get_mol(toMolfile(piece))
  if (!read) throw new Error("RDKit 读不了这个结构")
  try {
    if (kind === "smiles") return read.get_smiles()
    const inchi = read.get_inchi()
    if (!inchi) throw new Error("没能生成 InChI")
    return kind === "inchi" ? inchi : rdkit.get_inchikey_for_inchi(inchi)
  } finally {
    read.delete()
  }
}
