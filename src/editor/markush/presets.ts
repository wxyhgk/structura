import { GROUP_CLASSES } from "@structura/markush"
import type { Alternative } from "@structura/core/types"
import { CLASS_NAMES, describeAlternative } from "./describe.ts"

/** For a linker such as L: "a single bond, (C6–C30)arylene or (3–30 membered)heteroarylene". */
export const LINKER_PRESETS: Alternative[] = [
  { kind: "bond" },
  { kind: "class", class: "arylene", min: 6, max: 30 },
  { kind: "class", class: "heteroarylene", min: 3, max: 30 },
]

/** The classes patent claims name most, one click each; "更多…" opens the full form. */
export const PRESETS: Alternative[] = [
  { kind: "class", class: "alkyl", min: 1, max: 30 },
  { kind: "class", class: "aryl", min: 6, max: 30 },
  { kind: "class", class: "heteroaryl", min: 3, max: 30 },
  { kind: "class", class: "silyl" },
  { kind: "class", class: "amino" },
]

/** "C1–C30 烷基", "3–30 元杂芳基": a preset's button text. */
export function shortName(item: Alternative): string {
  if (item.kind !== "class") return describeAlternative(item)
  const range = item.min != null ? (GROUP_CLASSES[item.class].size === "members" ? `${item.min}–${item.max} 元` : `C${item.min}–C${item.max} `) : ""
  return `${range}${CLASS_NAMES[item.class]}`
}

