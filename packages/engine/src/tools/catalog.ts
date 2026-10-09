import type { AttachmentShape } from "@structura/markush"
import { scaffoldNamed } from "@structura/core/scaffolds"
import type { BondStyle, Bracket, RingKind } from "@structura/core/types"
import { ATTACH_SHAPE_NAMES, BOND_NAMES, BRACKET_NAMES, RING_NAMES, TOOL_NAMES, toolSetTo } from "../i18n/zh.ts"
import type { ToolId, ToolSettings } from "./types.ts"

// The tools the palette offers: bond styles, ring kinds, bracket kinds, attachment shapes and their labels.
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

/** The brackets the bracket tool puts round atoms: a group, or a repeat unit [ … ]n. */
export const BRACKET_KINDS: { kind: Bracket["kind"]; label: string }[] = (["group", "repeat"] as const).map((kind) => ({ kind, label: BRACKET_NAMES[kind] }))

/** How the attachment tool draws what it makes; null chooses from the attachment. A bracket's look follows from where it goes, so it is not offered. */
export const ATTACH_SHAPES: { shape: AttachmentShape | null; label: string }[] = ([null, "line", "loop", "arc"] as const).map((shape) => ({
  shape,
  label: ATTACH_SHAPE_NAMES[shape ?? "auto"],
}))

/** The status bar's name for a tool as set up now: the bond style, ring, element… it draws. */
export function toolLabel(tool: ToolId, settings: Partial<ToolSettings>): string {
  const { bondStyle, ringKind, atomEl, scaffold, bracketKind, attachShape } = settings
  if (tool === "scaffold") return `${TOOL_NAMES.scaffold} ${scaffoldNamed(scaffold?.name ?? "")?.zh ?? ""}`
  if (tool === "atom") return atomEl ?? ""
  if (tool === "ring") return RING_KINDS.find((item) => item.kind === ringKind)?.label ?? TOOL_NAMES.ring
  if (tool === "bond") return BOND_STYLES.find((item) => bondStyle && sameStyle(item.style, bondStyle))?.label ?? BOND_NAMES.single
  if (tool === "bracket") return bracketKind ? toolSetTo(TOOL_NAMES.bracket, BRACKET_NAMES[bracketKind]) : TOOL_NAMES.bracket
  if (tool === "attach") return attachShape === undefined ? TOOL_NAMES.attach : toolSetTo(TOOL_NAMES.attach, ATTACH_SHAPE_NAMES[attachShape ?? "auto"])
  return TOOL_NAMES[tool]
}

export function sameStyle(a: BondStyle, b: BondStyle): boolean {
  return a.order === b.order && a.stereo === b.stereo && a.look === b.look && a.emphasis === b.emphasis
}
