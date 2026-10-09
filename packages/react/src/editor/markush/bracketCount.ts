import type { Repeat } from "@structura/markush"

/** A repeat bracket's count as typed: its name and the least and most times. */
export type CountDraft = { name: string; min: string; max: string }

/** What is typed, as a repeat bracket's count, or why it cannot be one. */
export function bracketCountOf(draft: CountDraft): Repeat | string {
  const name = draft.name.trim()
  if (!/^[a-z]\d{0,2}'?$/.test(name)) return "次数的名字用一个小写字母，如 n、m"
  const min = Number(draft.min)
  const max = Number(draft.max)
  if (draft.min.trim() === "" || draft.max.trim() === "" || !Number.isInteger(min) || !Number.isInteger(max)) return "最少和最多次数要写整数"
  if (min < 0 || min > max || max > 100) return "次数要在 0 到 100 之间，且最少不大于最多"
  return { name, min, max }
}
