import { displayFormula } from "@structura/core/formula"
import { type Alternative, type BridgeName, type Choice, fragmentFormula, type GroupClass, type Proviso, REPRESENTATIVES, type RingClosure, sizeUnitOf } from "@structura/markush"

// Generic-formula wording for the editor: class, ring and representative names in Chinese.

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

/** The divalent rings a linker can be, by name. Typed by BridgeName, so none is missed. */
export const BRIDGE_NAMES: Record<BridgeName, string> = {
  "p-phenylene": "对亚苯基",
  "m-phenylene": "间亚苯基",
  "4,4'-biphenylene": "4,4′-联亚苯基",
  "2,5-pyridinediyl": "2,5-亚吡啶基",
}

/** "取代或未取代的 (C1–C30) 烷基", as a claim would put it; a label is itself, a piece its name or formula. */
export function describeAlternative(alternative: Alternative): string {
  if (alternative.kind === "label") return alternative.text
  if (alternative.kind === "bond") return "单键"
  if (alternative.kind === "bridge") return BRIDGE_NAMES[alternative.name]
  if (alternative.kind === "fragment") {
    const named = alternative.name ?? `片段 ${displayFormula(fragmentFormula(alternative.molecule))}`
    return alternative.alsoAt?.length ? `${named}（${alternative.alsoAt.length + 1} 个位点）` : named
  }
  const { min, max } = alternative
  const range = min != null || max != null ? `${min ?? 1}–${max ?? "∞"}` : ""
  const size = range ? (sizeUnitOf(alternative) === "members" ? `(${range} 元)` : `(C${range.replace("–", "–C")})`) : ""
  const substituted = alternative.substituted == null ? "取代或未取代的" : alternative.substituted ? "取代的" : "未取代的"
  const carried = alternative.substituents
  const carrying = carried ? `（被 ${carried.min === carried.max ? carried.min : `${carried.min}–${carried.max}`} 个 ${carried.from.join("、")} 取代）` : ""
  return `${substituted}${size}${CLASS_NAMES[alternative.class]}${carrying}`
}

/** Chinese names for the representative labels that stand in for classes when generating (see REPRESENTATIVES). */
const REPRESENTATIVE_NAMES = new Map(
  Object.values(REPRESENTATIVES)
    .flat()
    .flatMap((item) => (item.choice.kind === "label" ? [[item.choice.text, item.zh] as const] : [])),
)

/** "2-吡啶基" for a representative label, the bridge's name, or 单键. */
export function choiceName(choice: Choice): string {
  if (choice.kind === "label") return REPRESENTATIVE_NAMES.get(choice.text) ?? choice.text
  return describeAlternative(choice)
}

/** A proviso as the claim would say it: "排除：R1 = H 且 R2 = H", or the excluded compound. */
export function provisoText(proviso: Proviso): string {
  if (proviso.kind === "compound") return `排除化合物：${proviso.smiles}`
  return `排除：${proviso.when.map((condition) => `${condition.name} = ${condition.is.map(describeAlternative).join(" 或 ")}`).join(" 且 ")}`
}

/** A ring closure as the claim says it: "R1 与 R2 可一起成环：(CH2)3、(CH2)4". */
export function closureText(closure: RingClosure): string {
  return `${closure.a} 与 ${closure.b} 可一起成环：${closure.ring.map(describeAlternative).join("、")}`
}
