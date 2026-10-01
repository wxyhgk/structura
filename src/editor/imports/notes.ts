import type { MolRecord } from "@structura/core/sdf"
import type { Problem } from "@structura/core/validate"

/** What the import dialog shows: whether anything was opened, and one line per problem. */
export type ImportNotes = { opened: boolean; lines: string[] }

const PROBLEM_TEXT: Partial<Record<Problem["code"], string>> = {
  "bad-molfile": "无法读取",
  "unsupported-mol-feature": "含有暂不支持的内容",
  "missing-coordinates": "文件没有坐标，原子会重叠在一起",
  "flattened-3d": "三维坐标已投影到平面",
  "aromatic-unresolved": "部分芳香键无法确定单双键",
  valence: "有原子超价",
}

/** One line per problem, in Chinese, naming the record when the file had several. */
export function importNotes(records: MolRecord[], problems: Problem[]): string[] {
  return problems.map((problem) => {
    const record = problem.record != null ? records[problem.record - 1] : undefined
    const where = records.length > 1 && record ? `第 ${problem.record} 条${record.title ? `（${record.title}）` : ""}：` : ""
    return `${where}${PROBLEM_TEXT[problem.code] ?? problem.code}。${problem.message}`
  })
}
