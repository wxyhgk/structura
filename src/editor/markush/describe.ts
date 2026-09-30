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
  arylene: "亚芳基",
  heteroarylene: "亚杂芳基",
}

/** Classes whose size counts ring members ("3–30 元") rather than carbons ("C1–C30"). */
const BY_MEMBERS = new Set<GroupClass>(["heteroaryl", "heterocycloalkyl", "heteroarylene"])

/** "取代或未取代的 (C1–C30) 烷基", as a claim would put it; a label is itself. */
export function describeAlternative(alternative: Alternative): string {
  if (alternative.kind === "label") return alternative.text
  if (alternative.kind === "bond") return "单键"
  const { min, max } = alternative
  const range = min != null || max != null ? `${min ?? 1}–${max ?? "∞"}` : ""
  const size = range ? (BY_MEMBERS.has(alternative.class) ? `(${range} 元)` : `(C${range.replace("–", "–C")})`) : ""
  const substituted = alternative.substituted == null ? "取代或未取代的" : alternative.substituted ? "取代的" : "未取代的"
  return `${substituted}${size}${CLASS_NAMES[alternative.class]}`
}

/** Words that stand for several labels at once. */
const SHORTHANDS: Record<string, string[]> = { 卤素: ["F", "Cl", "Br", "I"], halogen: ["F", "Cl", "Br", "I"], 氢: ["H"], 氘: ["D"] }

/** What typing "单键" means: a direct bond, for a linker. */
export const BOND_WORDS = new Set(["单键", "bond", "single bond"])

/** Labels typed in one go: "H, D, 卤素、CN" gives H, D, F, Cl, Br, I, CN, without repeats. */
export function parseLabels(text: string): string[] {
  const words = text.split(/[,，、;；\s]+/).map((word) => word.trim()).filter(Boolean)
  return [...new Set(words.flatMap((word) => SHORTHANDS[word] ?? [word]))]
}

/** Chinese names for the representatives that stand in for classes when generating. */
const REPRESENTATIVE_NAMES: Record<string, string> = {
  Me: "甲基",
  Et: "乙基",
  iPr: "异丙基",
  tBu: "叔丁基",
  CF3: "三氟甲基",
  Vinyl: "乙烯基",
  Allyl: "烯丙基",
  Ethynyl: "乙炔基",
  Propargyl: "炔丙基",
  cPr: "环丙基",
  Cy: "环己基",
  THP: "四氢吡喃基",
  Ph: "苯基",
  "1-Naphthyl": "1-萘基",
  "2-Naphthyl": "2-萘基",
  "4-Biphenylyl": "4-联苯基",
  Tol: "甲苯基",
  Mes: "均三甲苯基",
  "2-Pyridyl": "2-吡啶基",
  "2-Furyl": "2-呋喃基",
  "2-Thienyl": "2-噻吩基",
  "2-Pyrimidinyl": "2-嘧啶基",
  "3-Indolyl": "3-吲哚基",
  OMe: "甲氧基",
  OEt: "乙氧基",
  OPh: "苯氧基",
  Si: "甲硅烷基（SiH₃）",
  TMS: "三甲基硅基",
  SiPh3: "三苯基硅基",
  N: "氨基（NH₂）",
  NMe2: "二甲氨基",
  NHPh: "苯氨基",
  "p-phenylene": "对亚苯基",
  "m-phenylene": "间亚苯基",
  "4,4'-biphenylene": "4,4′-联亚苯基",
  "2,5-pyridinediyl": "2,5-亚吡啶基",
}

/** "2-吡啶基", or the label itself when there is no Chinese name for it. */
export function representativeName(label: string): string {
  return REPRESENTATIVE_NAMES[label] ?? label
}
