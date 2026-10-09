import { scaffoldNamed } from "@structura/core/scaffolds"
import type { BondStyle, RingKind } from "@structura/core/types"
import { BOND_NAMES, RING_NAMES, TOOL_NAMES } from "../i18n/zh.ts"
import type { ScaffoldPick, ToolId } from "./types.ts"

// The tools the palette offers: bond styles, ring kinds and their labels.
export const BOND_STYLES: { style: BondStyle; label: string }[] = [
  { style: { order: 1, stereo: "none" }, label: BOND_NAMES.single },
  { style: { order: 2, stereo: "none" }, label: BOND_NAMES.double },
  { style: { order: 3, stereo: "none" }, label: BOND_NAMES.triple },
  { style: { order: 1, stereo: "up" }, label: BOND_NAMES.wedge },
  { style: { order: 1, stereo: "down" }, label: BOND_NAMES.hash },
  { style: { order: 1, stereo: "either" }, label: BOND_NAMES.wavy },
]

/** The rings the palette offers: all but cyclopentene, which only a bond hotkey makes. */
export const RING_KINDS: { kind: RingKind; label: string }[] = (
  ["benzene", "cyclohexane", "cyclopentane", "cyclobutane", "cyclopropane", "cycloheptane", "cyclooctane"] as const
).map((kind) => ({ kind, label: RING_NAMES[kind] }))

export function toolLabel(tool: ToolId, bond: BondStyle, ring: RingKind, el: string, scaffold?: ScaffoldPick): string {
  if (tool === "scaffold") return `${TOOL_NAMES.scaffold} ${scaffoldNamed(scaffold?.name ?? "")?.zh ?? ""}`
  if (tool === "atom") return el
  if (tool === "ring") return RING_KINDS.find((item) => item.kind === ring)?.label ?? TOOL_NAMES.ring
  if (tool === "bond") return BOND_STYLES.find((item) => sameStyle(item.style, bond))?.label ?? BOND_NAMES.single
  return TOOL_NAMES[tool]
}

export function sameStyle(a: BondStyle, b: BondStyle): boolean {
  return a.order === b.order && a.stereo === b.stereo && a.look === b.look && a.emphasis === b.emphasis
}
