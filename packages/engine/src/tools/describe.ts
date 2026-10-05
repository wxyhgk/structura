import type { AtomAction, BondAction } from "../hotkeys/lookup.ts"
import type { BondStyle } from "@structura/core/types"
import { BOND_STYLES, RING_NAMES, sameStyle } from "./catalog.ts"

// What the hover keys do, in words, worked out from the key tables so the help never drifts.

const RECIPE_NAMES: Record<string, string> = {
  carbonyl: "羰基（末端接成乙酰基）",
  fork: "分叉",
  "stereo-pair": "一实一虚两根键",
  sulfonyl: "磺酰基",
  nitro: "硝基",
  azide: "叠氮基",
  trifluoromethyl: "CF₃",
  "tert-butyl": "叔丁基",
  methoxy: "甲氧基",
  "magnesium-bromide": "MgBr",
  chair: "椅式环己烷",
  "chair-flipped": "椅式环己烷（另一朝向）",
}

function styleName(style: BondStyle): string {
  if (style.look === "bold") return "粗键"
  if (style.look === "dashed") return "虚线键"
  if (style.look === "shadow") return "阴影键"
  if (style.emphasis === "bold") return "双键（一侧加粗）"
  if (style.emphasis === "dashed") return "双键（一侧虚线）"
  return BOND_STYLES.find((item) => sameStyle(item.style, style))?.label ?? "键"
}

export function describeAtomAction(action: AtomAction): string {
  switch (action.do) {
    case "extend":
      return action.style.order === 1 && action.style.stereo === "none" ? "延长碳链" : `接一根${styleName(action.style)}`
    case "sprout-up":
      return "向上加一根键"
    case "phenyl":
      return "接苯环"
    case "ring":
      return `接${RING_NAMES[action.kind]}；已有两根键时变成螺环`
    case "recipe":
      return action.inChain
        ? `末端接${RECIPE_NAMES[action.name]}，链中间接${RECIPE_NAMES[action.inChain]}`
        : `接${RECIPE_NAMES[action.name]}`
    case "become":
      return `换成 ${action.el}`
    case "isotope":
      return `换成 ${[...String(action.isotope)].map((digit) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(digit)]).join("")}${action.el}`
    case "label":
      return `接 ${action.text}`
    case "charge":
      return action.delta > 0 ? "加正电荷" : "加负电荷"
  }
}

export function describeBondAction(action: BondAction): string {
  switch (action.do) {
    case "style":
      return `改成${styleName(action.style)}`
    case "fuse":
      return `并${RING_NAMES[action.kind]}`
    case "fuse-chair":
      return action.turn > 0 ? "并椅式环己烷" : "并椅式环己烷（另一朝向）"
  }
}

/** "k", or "⇧K" for an upper-case key. */
export function hotkeyLabel(key: string): string {
  return /^[A-Z]$/.test(key) ? `⇧${key}` : key
}
