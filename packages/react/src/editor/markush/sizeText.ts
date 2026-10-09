import type { LibrarySize } from "@structura/markush"
import { choiceName, repeatSkipText } from "./describe.ts"

/** A count as people read it: 1 234, or 2.3 × 10⁶ once it is large. */
export function countText(count: number): string {
  if (count < 1_000_000) return count.toLocaleString("zh-CN")
  const power = Math.floor(Math.log10(count))
  const superscript = String(power).replace(/\d/g, (digit) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(digit)])
  return `${(count / 10 ** power).toFixed(1)} × 10${superscript}`
}

/**
 * The library's size for the 概览 tab, before anything is generated: the headline,
 * and what it leaves out (classes stand in by typical members, so the real scope is wider).
 */
export function sizeText(size: LibrarySize): { headline: string; notes: string[] } {
  if (size.onlyClasses.length > 0) return { headline: "还不能计数", notes: [`${size.onlyClasses.join("、")} 只有基团类别，没有具体候选项`] }
  const notes = [
    ...Object.entries(size.represented).map(([name, choices]) => `${name} 的基团类别按代表结构计（${choices.map(choiceName).join("、")}），实际范围更大`),
    ...size.skippedRepeats.map(repeatSkipText),
  ]
  return { headline: `可展开为 ${countText(size.combinations)} 种组合`, notes }
}
