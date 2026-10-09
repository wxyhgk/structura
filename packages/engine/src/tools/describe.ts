import type { AtomAction, BondAction } from "../hotkeys/lookup.ts"
import type { BondStyle } from "@structura/core/types"
import { ACTION_WORDS, BOND_NAMES, RECIPE_NAMES, RING_NAMES } from "../i18n/zh.ts"
import { BOND_STYLES, sameStyle } from "./catalog.ts"

// What the hover keys do, in words, worked out from the key tables so the help never drifts.

function styleName(style: BondStyle): string {
  if (style.look === "bold") return BOND_NAMES.bold
  if (style.look === "dashed") return BOND_NAMES.dashed
  if (style.look === "shadow") return BOND_NAMES.shadow
  if (style.emphasis === "bold") return BOND_NAMES["double-bold"]
  if (style.emphasis === "dashed") return BOND_NAMES["double-dashed"]
  return BOND_STYLES.find((item) => sameStyle(item.style, style))?.label ?? BOND_NAMES.any
}

export function describeAtomAction(action: AtomAction): string {
  switch (action.do) {
    case "extend":
      return action.style.order === 1 && action.style.stereo === "none" ? ACTION_WORDS.extendChain : ACTION_WORDS.extendWith(styleName(action.style))
    case "sprout-up":
      return ACTION_WORDS.sproutUp
    case "phenyl":
      return ACTION_WORDS.phenyl
    case "ring":
      return ACTION_WORDS.ring(RING_NAMES[action.kind])
    case "recipe":
      return action.inChain
        ? ACTION_WORDS.recipeInChain(RECIPE_NAMES[action.name], RECIPE_NAMES[action.inChain])
        : ACTION_WORDS.recipe(RECIPE_NAMES[action.name])
    case "become":
      return ACTION_WORDS.become(action.el)
    case "isotope":
      return ACTION_WORDS.become(`${[...String(action.isotope)].map((digit) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(digit)]).join("")}${action.el}`)
    case "label":
      return ACTION_WORDS.label(action.text)
    case "charge":
      return action.delta > 0 ? ACTION_WORDS.chargePlus : ACTION_WORDS.chargeMinus
  }
}

export function describeBondAction(action: BondAction): string {
  switch (action.do) {
    case "style":
      return ACTION_WORDS.restyle(styleName(action.style))
    case "fuse":
      return ACTION_WORDS.fuse(RING_NAMES[action.kind])
    case "fuse-chair":
      return action.turn > 0 ? ACTION_WORDS.fuseChair : ACTION_WORDS.fuseChairFlipped
  }
}

/** "k", or "⇧K" for an upper-case key. */
export function hotkeyLabel(key: string): string {
  return /^[A-Z]$/.test(key) ? `⇧${key}` : key
}
