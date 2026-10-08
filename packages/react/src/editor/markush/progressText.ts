import type { Enumeration } from "@structura/markush"

/** How many to generate at most, for the user to pick; the SD file holds them all. */
export const LIMITS = [100, 500, 2000]
/** The limit picked until the user picks another. */
export const DEFAULT_LIMIT = 500

/**
 * A generation's state in a line: progress while generating, then what was made. `shown`
 * is how many the caller draws, when it draws fewer than were made.
 */
export function progressText({ result, status }: { result: Enumeration | null; status: "running" | "done" | "stopped" }, limit: number, shown?: number): string {
  if (!result) return status === "running" ? "正在生成…" : "没有可以生成的化合物。"
  const made = result.molecules.length
  if (status === "running") return `正在生成：已生成 ${made} / 共 ${Math.min(result.total, limit)}…`
  if (result.total === 0) return "没有可以生成的化合物。"
  const drawn = shown != null && made > shown ? `，下面显示前 ${shown} 个` : ""
  const repeats = result.duplicates > 0 ? `（合并了 ${result.duplicates} 个重复的）` : ""
  return `共 ${result.total} 种组合，得到 ${made} 个${result.duplicates > 0 ? "不同的" : ""}化合物${repeats}${drawn}${status === "stopped" ? "（已停止）" : ""}。`
}
