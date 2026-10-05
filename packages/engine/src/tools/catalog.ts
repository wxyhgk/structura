import { scaffoldNamed } from "@structura/core/scaffolds"
import type { BondStyle, RingKind } from "@structura/core/types"
import type { ScaffoldPick, ToolId } from "./types.ts"

// The tools the palette offers: bond styles, ring kinds and their labels.
export const BOND_STYLES: { style: BondStyle; label: string }[] = [
  { style: { order: 1, stereo: "none" }, label: "单键" },
  { style: { order: 2, stereo: "none" }, label: "双键" },
  { style: { order: 3, stereo: "none" }, label: "三键" },
  { style: { order: 1, stereo: "up" }, label: "楔形键" },
  { style: { order: 1, stereo: "down" }, label: "虚楔键" },
  { style: { order: 1, stereo: "either" }, label: "波浪键" },
]

/** Every ring's name; the palette offers all but cyclopentene, which only a bond hotkey makes. */
export const RING_NAMES: Record<RingKind, string> = {
  benzene: "苯",
  cyclohexane: "环己烷",
  cyclopentane: "环戊烷",
  cyclopentene: "环戊烯",
  cyclobutane: "环丁烷",
  cyclopropane: "环丙烷",
  cycloheptane: "环庚烷",
  cyclooctane: "环辛烷",
}

export const RING_KINDS: { kind: RingKind; label: string }[] = (
  ["benzene", "cyclohexane", "cyclopentane", "cyclobutane", "cyclopropane", "cycloheptane", "cyclooctane"] as const
).map((kind) => ({ kind, label: RING_NAMES[kind] }))

export function toolLabel(tool: ToolId, bond: BondStyle, ring: RingKind, el: string, scaffold?: ScaffoldPick): string {
  if (tool === "scaffold") return `模板 ${scaffoldNamed(scaffold?.name ?? "")?.zh ?? ""}`
  if (tool === "lasso") return "套索"
  if (tool === "marquee") return "框选"
  if (tool === "chain") return "碳链"
  if (tool === "eraser") return "橡皮"
  if (tool === "charge-plus") return "正电荷"
  if (tool === "charge-minus") return "负电荷"
  if (tool === "atom") return el
  if (tool === "ring") return RING_KINDS.find((item) => item.kind === ring)?.label ?? "环"
  return BOND_STYLES.find((item) => sameStyle(item.style, bond))?.label ?? "单键"
}

export function sameStyle(a: BondStyle, b: BondStyle): boolean {
  return a.order === b.order && a.stereo === b.stereo && a.look === b.look && a.emphasis === b.emphasis
}
