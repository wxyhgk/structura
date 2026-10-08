import { toSdf } from "@structura/core/molfile"
import type { Molecule } from "@structura/core/types"
import { download } from "../browser.ts"
import { loadRDKit } from "../rdkit.ts"
import { canonicalIdentity } from "./identity.ts"
import { rowFields, rowsToCsv, rowsToSmiles, type Row } from "./results.ts"

// Generated compounds saved as files named after the document: "<base> 展开.sdf" and so on.

/** The rows as an SD file, each compound's variables as data items. */
export function downloadSdf(base: string, rows: readonly Row[]) {
  download(`${base} 展开.sdf`, toSdf(rows.map((row) => row.mol), "Structura", rows.map(rowFields)), "chemical/x-mdl-sdfile")
}

/** Writes the rows as SMILES-bearing text; RDKit is loaded for it on first use. */
async function downloadWithSmiles(base: string, rows: readonly Row[], write: (rows: readonly Row[], smiles: (mol: Molecule) => string) => string, extension: string, type: string) {
  const rdkit = await loadRDKit()
  const identity = canonicalIdentity(rdkit)
  download(`${base} 展开.${extension}`, write(rows, (mol) => identity(mol) ?? ""), type)
}

export const downloadSmiles = (base: string, rows: readonly Row[]) => downloadWithSmiles(base, rows, rowsToSmiles, "smi", "chemical/x-daylight-smiles")
export const downloadCsv = (base: string, rows: readonly Row[]) => downloadWithSmiles(base, rows, rowsToCsv, "csv", "text/csv")
