import type { Enumeration } from "@structura/markush"
import { choiceName } from "./describe.ts"

/**
 * What the user should know about what was, and was not, generated. While generation is
 * still `running` nothing is missing yet; `stopped` means the user cut it short, so fewer
 * than `limit` were made on purpose, not for the limit.
 */
export function notesOf(result: Enumeration, { limit, status = "done" }: { limit: number; status?: "running" | "done" | "stopped" }): string[] {
  const notes: string[] = []
  for (const [name, choices] of Object.entries(result.represented)) {
    notes.push(`${name} 的基团类别用代表结构展开：${choices.map(choiceName).join("、")}。`)
  }
  for (const [name, choices] of Object.entries(result.misfits)) {
    notes.push(`${name} 所在的位置放不下 ${choices.map(choiceName).join("、")}，这些已跳过（链末端只能接一价基团，环里只能是元素，连接基只能是单键、亚芳基或 O、S 这类原子）。`)
  }
  if (result.onlyClasses.length > 0) {
    notes.push(`${result.onlyClasses.join("、")} 没有能放在该位置的具体候选项；请勾选上面的选项用代表结构，或补充具体候选项（如 H、Me、Ph）。`)
  }
  for (const [name, count] of Object.entries(result.classesLeftOut)) {
    if (!result.onlyClasses.includes(name)) notes.push(`${name} 有 ${count} 个基团类别没有展开，只用了具体候选项。`)
  }
  if (result.occupied > 0) notes.push(`有 ${result.occupied} 种连接位置已经接了别的基团，没有空位，已跳过。`)
  if (result.undefinedNames.length > 0) notes.push(`${result.undefinedNames.join("、")} 还没有候选项，生成的结构里保留为占位符。`)
  if (result.failed > 0) {
    const first = result.failures[0]
    const picks = first.choice.map((pick) => ("position" in pick ? `${pick.name} 连在 ${pick.position} 位置` : `${pick.name} = ${choiceName(pick.choice)}`))
    notes.push(`${result.failed} 种组合没能生成，例如 ${picks.join("，")}（${first.error}）。`)
  }
  const tried = result.molecules.length + result.failed + result.duplicates
  if (status === "running" || result.total <= tried) return notes
  notes.push(status === "stopped" ? `已停止生成，只生成了前 ${tried} 种。` : `组合太多，只生成了前 ${limit} 种。`)
  return notes
}
