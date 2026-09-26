import type { BondStyle, RingKind, ToolId } from "@/chem/types"

export const BOND_STYLES: { style: BondStyle; label: string }[] = [
  { style: { order: 1, stereo: "none" }, label: "单键" },
  { style: { order: 2, stereo: "none" }, label: "双键" },
  { style: { order: 3, stereo: "none" }, label: "三键" },
  { style: { order: 1, stereo: "up" }, label: "楔形键" },
  { style: { order: 1, stereo: "down" }, label: "虚楔键" },
  { style: { order: 1, stereo: "either" }, label: "波浪键" },
]

export const RING_KINDS: { kind: RingKind; label: string }[] = [
  { kind: "benzene", label: "苯" },
  { kind: "cyclohexane", label: "环己烷" },
  { kind: "cyclopentane", label: "环戊烷" },
  { kind: "cyclobutane", label: "环丁烷" },
  { kind: "cyclopropane", label: "环丙烷" },
]

export function toolLabel(tool: ToolId, bond: BondStyle, ring: RingKind, el: string): string {
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
