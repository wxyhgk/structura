import { toSdf } from "@structura/core/molfile"
import type { Molecule } from "@structura/core/types"
import { failure } from "../browser.ts"
import type { Save } from "../save.ts"
import { svgToPng } from "../clipboardImage.ts"
import { loadRDKit } from "../rdkit.ts"
import { zip } from "../zip.ts"
import { compoundTableFiles, tableCdxml } from "./compoundTable.ts"
import { pictureDocx, type Rasterize } from "./wordDocx.ts"
import type { WordExport } from "./wordExport.ts"
import { canonicalIdentity } from "./identity.ts"
import { rowFields, rowName, rowsToCsv, rowsToSmiles, type Row } from "./results.ts"

// Generated compounds saved as files named after the document: "<base> 展开.sdf" and so on.

/** The rows as an SD file: each record titled with the compound's number, which is also its ID item, then its variables. */
export function downloadSdf(download: Save, base: string, rows: readonly Row[]) {
  const fields = rows.map((row) => ({ ID: rowName(row), ...rowFields(row) }))
  download(`${base} 展开.sdf`, toSdf(rows.map((row) => row.mol), rows.map(rowName), fields), "chemical/x-mdl-sdfile")
}

/** The table of compounds as one ChemDraw document, `columns` to a row. */
export function downloadTableCdxml(download: Save, base: string, rows: readonly Row[], columns: number) {
  download(`${base} 化合物表.cdxml`, tableCdxml(rows, columns), "chemical/x-cdxml")
}

/**
 * The table of compounds as a package for building it elsewhere (a Word table, by
 * chem2office): see compoundTable.ts. SMILES come along when RDKit loads; without it, the rest.
 */
export async function downloadCompoundTable(download: Save, base: string, rows: readonly Row[], columns: number) {
  download(`${base} 化合物表.zip`, await compoundPackage(base, rows, columns), "application/zip")
}

/** The package as zip bytes, with SMILES when RDKit loads. */
async function compoundPackage(base: string, rows: readonly Row[], columns: number): Promise<Uint8Array<ArrayBuffer>> {
  let smiles: ((mol: Molecule) => string | null) | undefined
  try {
    smiles = canonicalIdentity(await loadRDKit())
  } catch {
    smiles = undefined
  }
  return zip(compoundTableFiles(rows, { columns, source: base, smiles }))
}

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

/** A structure's SVG as PNG at three times its size (sharp when printed), with the SVG's own size. */
const rasterizeInPage: Rasterize = async (svg) => {
  const [, width, height] = /width="([\d.]+)" height="([\d.]+)"/.exec(svg)?.map(Number) ?? [0, 1, 1]
  return { png: new Uint8Array(await (await svgToPng(svg, 3)).arrayBuffer()), width, height }
}

/** What 导出 Word made: editable ChemDraw objects (through the host), or pictures, and why not editable. */
export type WordResult = { editable: true } | { editable: false; reason?: string }

/**
 * The table of compounds as a Word document: with editable ChemDraw objects when the host can
 * make them (wordExport, chem2office), else with pictures made in the page, saying why.
 */
export async function downloadWord(download: Save, base: string, rows: readonly Row[], columns: number, wordExport?: WordExport): Promise<WordResult> {
  const name = `${base} 化合物表.docx`
  let reason: string | undefined
  if (wordExport) {
    const ready = await wordExport.check().catch((error: unknown) => ({ available: false as const, reason: failure(error) }))
    if (ready.available) {
      try {
        download(name, await wordExport.make(await compoundPackage(base, rows, columns), { columns }), DOCX)
        return { editable: true }
      } catch (error) {
        reason = `可编辑版生成失败：${failure(error)}`
      }
    } else reason = ready.reason
  }
  download(name, await pictureDocx(rows, columns, rasterizeInPage), DOCX)
  return { editable: false, reason }
}

/** Writes the rows as SMILES-bearing text; RDKit is loaded for it on first use. */
async function downloadWithSmiles(download: Save, base: string, rows: readonly Row[], write: (rows: readonly Row[], smiles: (mol: Molecule) => string) => string, extension: string, type: string) {
  const rdkit = await loadRDKit()
  const identity = canonicalIdentity(rdkit)
  download(`${base} 展开.${extension}`, write(rows, (mol) => identity(mol) ?? ""), type)
}

export const downloadSmiles = (download: Save, base: string, rows: readonly Row[]) => downloadWithSmiles(download, base, rows, rowsToSmiles, "smi", "chemical/x-daylight-smiles")
export const downloadCsv = (download: Save, base: string, rows: readonly Row[]) => downloadWithSmiles(download, base, rows, rowsToCsv, "csv", "text/csv")
