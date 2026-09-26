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
  { kind: "cycloheptane", label: "环庚烷" },
  { kind: "cyclooctane", label: "环辛烷" },
]

/**
 * What a key does when the pointer is not over an atom or bond: pick a tool, and for the
 * bond and ring tools, which kind. Letters match either case unless an upper-case entry
 * exists (W is the hashed wedge, w the solid one), mirroring the hover keys on bonds.
 */
export type ToolKey =
  | { key: string; tool: "bond"; style: BondStyle; label: string }
  | { key: string; tool: "ring"; ring: RingKind; label: string }
  | { key: string; tool: Exclude<ToolId, "bond" | "ring">; label: string }
  | { key: string; tool: "ring-current"; label: string }

export const TOOL_KEYS: ToolKey[] = [
  { key: "v", tool: "lasso", label: "套索" },
  { key: "m", tool: "marquee", label: "框选" },
  { key: "k", tool: "chain", label: "碳链" },
  { key: "e", tool: "eraser", label: "橡皮" },
  { key: "b", tool: "bond", style: { order: 1, stereo: "none" }, label: "单键" },
  { key: "x", tool: "bond", style: { order: 1, stereo: "none" }, label: "单键" },
  { key: "1", tool: "bond", style: { order: 1, stereo: "none" }, label: "单键" },
  { key: "2", tool: "bond", style: { order: 2, stereo: "none" }, label: "双键" },
  { key: "3", tool: "bond", style: { order: 3, stereo: "none" }, label: "三键" },
  { key: "z", tool: "bond", style: { order: 3, stereo: "none" }, label: "三键" },
  { key: "w", tool: "bond", style: { order: 1, stereo: "up" }, label: "楔形键" },
  { key: "W", tool: "bond", style: { order: 1, stereo: "down" }, label: "虚楔键" },
  { key: "y", tool: "bond", style: { order: 1, stereo: "either" }, label: "波浪键" },
  { key: "r", tool: "ring-current", label: "环（上次的种类）" },
  { key: "j", tool: "ring", ring: "benzene", label: "苯" },
  { key: "a", tool: "ring", ring: "benzene", label: "苯" },
  { key: "t", tool: "ring", ring: "cyclopropane", label: "环丙烷" },
  { key: "4", tool: "ring", ring: "cyclobutane", label: "环丁烷" },
  { key: "5", tool: "ring", ring: "cyclopentane", label: "环戊烷" },
  { key: "6", tool: "ring", ring: "cyclohexane", label: "环己烷" },
  { key: "7", tool: "ring", ring: "cycloheptane", label: "环庚烷" },
  { key: "8", tool: "ring", ring: "cyclooctane", label: "环辛烷" },
]

export function toolForKey(key: string): ToolKey | undefined {
  return TOOL_KEYS.find((entry) => entry.key === key) ?? TOOL_KEYS.find((entry) => entry.key === key.toLowerCase() && !TOOL_KEYS.some((other) => other.key === key))
}

/** The keys that pick a given bond style or ring, for tooltips: "X / 1". */
export function keysFor(match: (entry: ToolKey) => boolean): string {
  return TOOL_KEYS.filter(match)
    .map((entry) => (entry.key.length === 1 && entry.key !== entry.key.toLowerCase() ? `⇧${entry.key}` : entry.key.toUpperCase()))
    .join(" / ")
}

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
