import type { MainModule } from "@rdkit/rdkit"
import { toSdf } from "@structura/core/molfile"
import type { Molecule } from "@structura/core/types"
import { failure } from "../editor/browser.ts"
import type { Save } from "../editor/save.ts"
import { svgToPng } from "../editor/clipboardImage.ts"
import { loadRDKit } from "../editor/rdkit.ts"
import { zip } from "./zip.ts"
import { compoundTableFiles, tableCdxml } from "./compoundTable.ts"
import { pictureDocx, type Rasterize } from "./wordDocx.ts"
import type { WordExport } from "./wordExport.ts"
import { inSlices } from "./asyncSlices.ts"
import { canonicalIdentity } from "./identity.ts"
import { peekProperties, PROPERTIES, propertyFields, rdProperties, sdfProperties } from "./properties.ts"
import { rowFields, rowName, rowsToCsv, rowsToSmiles, type Row } from "./results.ts"

// Generated compounds saved as files named after the document: "<base> 展开.sdf" and so on.

/**
 * The rows as SD records: each titled with the compound's number, which is also its ID item,
 * then its variables; with `properties`, then formula, weight and the RDKit properties
 * already computed (cLogP, TPSA…; left out where RDKit cannot read the compound).
 */
export function sdfOf(rows: readonly Row[], properties = false): string {
  const fields = rows.map((row) => ({ ID: rowName(row), ...rowFields(row), ...(properties ? sdfProperties(row.mol, peekProperties(row.mol)) : {}) }))
  return toSdf(rows.map((row) => row.mol), rows.map(rowName), fields)
}

/**
 * What a download could not do, to be told to the user instead of left as blanks: the
 * compounds RDKit cannot read (by number: their SMILES, or their cLogP and the other RDKit
 * properties, are empty), and whether RDKit could not be loaded at all.
 */
export type ExportReport = { saved: boolean; unreadable: string[]; noRdkit: boolean }

/** RDKit, or null when it cannot be loaded (offline: the wasm is fetched). */
const rdkitOrNull = (): Promise<MainModule | null> => loadRDKit().catch(() => null)

/** Reads every compound with RDKit (in slices): its SMILES (null: unreadable) and/or its properties, both remembered for the file. */
async function readWithRdkit(rdkit: MainModule, rows: readonly Row[], what: { smiles: boolean }): Promise<Map<Molecule, string | null>> {
  const identity = canonicalIdentity(rdkit)
  const smiles = new Map<Molecule, string | null>()
  await inSlices(rows, (row) => {
    if (what.smiles) smiles.set(row.mol, identity(row.mol))
    rdProperties(rdkit, row.mol)
  })
  return smiles
}

/** The compounds (by number) RDKit's reading failed for: no properties, or no SMILES when asked. */
const unreadableOf = (rows: readonly Row[], smiles?: Map<Molecule, string | null>): string[] => rows.filter((row) => (smiles ? smiles.get(row.mol) === null : peekProperties(row.mol) === null)).map(rowName)

/**
 * The rows as an SD file: each record titled with the compound's number, which is also its ID
 * item, then its variables, then formula, weight and RDKit's properties (cLogP, TPSA…; left out
 * where RDKit cannot read the compound).
 */
export async function downloadSdf(download: Save, base: string, rows: readonly Row[]): Promise<ExportReport> {
  const rdkit = await rdkitOrNull()
  if (rdkit) await readWithRdkit(rdkit, rows, { smiles: false })
  download(`${base} 展开.sdf`, sdfOf(rows, true), "chemical/x-mdl-sdfile")
  return { saved: true, unreadable: rdkit ? unreadableOf(rows) : [], noRdkit: !rdkit }
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

/** The SMILES file: one compound a line. Needs RDKit; without it nothing is written. */
export async function downloadSmiles(download: Save, base: string, rows: readonly Row[]): Promise<ExportReport> {
  const rdkit = await rdkitOrNull()
  if (!rdkit) return { saved: false, unreadable: [], noRdkit: true }
  const smiles = await readWithRdkit(rdkit, rows, { smiles: true })
  download(`${base} 展开.smi`, rowsToSmiles(rows, (mol) => smiles.get(mol) ?? ""), "chemical/x-daylight-smiles")
  return { saved: true, unreadable: unreadableOf(rows, smiles), noRdkit: false }
}

/** The CSV: number, SMILES, formula, weight, RDKit's properties and each variable. Without RDKit the SMILES and those properties are empty. */
export async function downloadCsv(download: Save, base: string, rows: readonly Row[]): Promise<ExportReport> {
  const rdkit = await rdkitOrNull()
  const smiles = rdkit ? await readWithRdkit(rdkit, rows, { smiles: true }) : new Map<Molecule, string | null>()
  const properties = { columns: PROPERTIES.filter((def) => def.key !== "mw").map((def) => def.field), of: (row: Row) => propertyFields(row.mol, peekProperties(row.mol)) }
  download(`${base} 展开.csv`, rowsToCsv(rows, (mol) => smiles.get(mol) ?? "", properties), "text/csv")
  return { saved: true, unreadable: rdkit ? unreadableOf(rows, smiles) : [], noRdkit: !rdkit }
}

/** What to tell the user after a download: nothing when all went well, else what is missing and for which compounds. */
export function exportNote(kind: "csv" | "sdf" | "smi", report: ExportReport): string | null {
  if (report.noRdkit)
    return kind === "smi" ? "RDKit 没有加载（需要联网下载），没法写 SMILES，没有生成文件。" : `RDKit 没有加载（需要联网下载）：${kind === "csv" ? "SMILES 和 cLogP 等性质一栏是空的" : "文件里没有 cLogP 等性质"}。`
  if (report.unreadable.length === 0) return null
  const which = report.unreadable.length > 6 ? `${report.unreadable.slice(0, 6).join("、")} 等` : report.unreadable.join("、")
  const left = kind === "smi" ? "没有写进文件" : kind === "csv" ? "它们的 SMILES 和 cLogP 等性质一栏是空的" : "它们没有 cLogP 等性质"
  return `有 ${report.unreadable.length} 个化合物 RDKit 读不了（${which}），${left}。`
}
