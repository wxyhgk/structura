import type { Enumeration } from "@structura/markush"
import { totalText } from "./sizeText.ts"

/** How many to generate at most, for the user to pick (the cards are drawn one by one); 导出全部 writes the whole library to a file. */
export const LIMITS = [100, 500, 2000]
/** The limit picked until the user picks another. */
export const DEFAULT_LIMIT = 500

/**
 * A generation's state in a line: progress while generating, then what was made. `shown`
 * is how many the caller draws, when it draws fewer than were made.
 */
export function progressText({ result, status, error }: { result: Enumeration | null; status: "running" | "done" | "stopped"; error?: string | null }, limit: number, shown?: number): string {
  if (error != null) return `生成时出错，已停止${result ? `（已生成 ${result.molecules.length} 个）` : ""}：${error}`
  if (!result) return status === "running" ? "正在生成…" : "没有可以生成的化合物。"
  const made = result.molecules.length
  if (status === "running") return `正在生成：已生成 ${made} / 共 ${Math.min(result.total, limit)}…`
  if (result.total === 0) return "没有可以生成的化合物。"
  const total = totalText(result.total, result.estimated)
  const tried = made + result.failed + result.duplicates + result.excluded
  // Picked evenly from more than there are: say how many were looked at, not only how many came out.
  const picked = result.order === "spread" && result.total > tried ? `，均匀取了 ${tried} 种` : ""
  const drawn = shown != null && made > shown ? `，下面显示前 ${shown} 个` : ""
  const repeats = result.duplicates > 0 ? `（合并了 ${result.duplicates} 个重复的）` : ""
  return `共 ${total} 种组合${picked}，得到 ${made} 个${result.duplicates > 0 ? "不同的" : ""}化合物${repeats}${drawn}${status === "stopped" ? "（已停止）" : ""}。`
}
