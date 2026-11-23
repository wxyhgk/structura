import { usableRecords } from "@structura/core/import"
import type { MolRecord } from "@structura/core/sdf"
import type { Molecule } from "@structura/core/types"
import type { Problem } from "@structura/core/validate"
import { smilesFault, smilesLines, smilesRecords, type SmilesFault } from "@structura/rdkit"
import type { MainModule } from "@rdkit/rdkit"
import { loadRDKit } from "../rdkit.ts"
import { importNotes } from "./notes.ts"

/** What is wrong with a SMILES, in Chinese, from what RDKit said. */
export function smilesFaultText(fault: SmilesFault): string {
  switch (fault.kind) {
    case "open-parenthesis":
      return "括号没有配对，少了右括号"
    case "close-parenthesis":
      return "括号没有配对，多了右括号"
    case "unclosed-ring":
      return "环没有闭合，有个环编号只出现了一次"
    case "syntax":
      return fault.position != null ? `第 ${fault.position} 个字符附近写法有误` : "写法有误"
    case "valence":
      return `第 ${fault.atom} 个原子（${fault.element}）超出化合价`
    case "kekulize":
      return `第 ${fault.atoms.join("、")} 个原子的芳香环无法确定单双键，可能少写了 [nH] 这样的氢`
  }
}

/**
 * The import notes for SMILES records: a SMILES RDKit could not read says why in Chinese,
 * with RDKit's own words after it.
 */
export function smilesNotes(records: MolRecord[], problems: Problem[]): string[] {
  return importNotes(records, problems, (problem) => {
    const fault = problem.code === "bad-molfile" ? smilesFault(problem.message) : null
    return fault ? `无法读取，${smilesFaultText(fault)}` : undefined
  })
}

/**
 * The molecules of SMILES text (one per line, a name after a space allowed), laid out by
 * RDKit, and one line per problem for the user. Kept apart from read.ts, which the editor-free
 * chem-structura/core uses: this one fetches RDKit.
 */
export async function readSmiles(text: string): Promise<{ molecules: Molecule[]; lines: string[] }> {
  if (smilesLines(text).length === 0) return { molecules: [], lines: ["没有找到 SMILES。"] }
  const records = smilesRecords(await loadRDKit(), text)
  const imported = usableRecords(records)
  const lines = smilesNotes(records, imported.problems)
  return { molecules: imported.molecules, lines: imported.molecules.length > 0 || lines.length > 0 ? lines : ["SMILES 里没有可以读取的分子。"] }
}

const RDKIT_FAILED = "RDKit 加载失败，请检查网络后重试。"

/** RDKit itself would not load, as opposed to a SMILES it then failed to convert. */
class RDKitLoadError extends Error {}

/** Loads RDKit for converting SMILES; a failure is marked as RDKit's, so it is not blamed on the text. */
export async function loadRDKitForSmiles(load: () => Promise<MainModule> = loadRDKit): Promise<MainModule> {
  try {
    return await load()
  } catch (error) {
    throw new RDKitLoadError(RDKIT_FAILED, { cause: error })
  }
}

/** What to tell the user when importing SMILES threw: the network only when RDKit did not load. */
export function smilesImportFailure(error: unknown): string {
  if (error instanceof RDKitLoadError) return error.message
  return `转换 SMILES 时出错：${error instanceof Error ? error.message : String(error)}`
}
