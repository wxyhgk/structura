import type { Alternative, GroupClass } from "@/chem/types"

// Generic-formula wording for the editor: class names, and what typed text means.

export const CLASS_NAMES: Record<GroupClass, string> = {
  alkyl: "烷基",
  alkenyl: "烯基",
  alkynyl: "炔基",
  cycloalkyl: "环烷基",
  heterocycloalkyl: "杂环烷基",
  aryl: "芳基",
  heteroaryl: "杂芳基",
  alkoxy: "烷氧基",
  aryloxy: "芳氧基",
  silyl: "甲硅烷基",
  amino: "氨基",
}

/** Classes whose size counts ring members ("3–30 元") rather than carbons ("C1–C30"). */
const BY_MEMBERS = new Set<GroupClass>(["heteroaryl", "heterocycloalkyl"])

/** "取代或未取代的 (C1–C30) 烷基", as a claim would put it; a label is itself. */
export function describeAlternative(alternative: Alternative): string {
  if (alternative.kind === "label") return alternative.text
  const { min, max } = alternative
  const range = min != null || max != null ? `${min ?? 1}–${max ?? "∞"}` : ""
  const size = range ? (BY_MEMBERS.has(alternative.class) ? `(${range} 元)` : `(C${range.replace("–", "–C")})`) : ""
  const substituted = alternative.substituted == null ? "取代或未取代的" : alternative.substituted ? "取代的" : "未取代的"
  return `${substituted}${size}${CLASS_NAMES[alternative.class]}`
}

/** Words that stand for several labels at once. */
const SHORTHANDS: Record<string, string[]> = { 卤素: ["F", "Cl", "Br", "I"], halogen: ["F", "Cl", "Br", "I"], 氢: ["H"], 氘: ["D"] }

/** Labels typed in one go: "H, D, 卤素、CN" gives H, D, F, Cl, Br, I, CN, without repeats. */
export function parseLabels(text: string): string[] {
  const words = text.split(/[,，、;；\s]+/).map((word) => word.trim()).filter(Boolean)
  return [...new Set(words.flatMap((word) => SHORTHANDS[word] ?? [word]))]
}
