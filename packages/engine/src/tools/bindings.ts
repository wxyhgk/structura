import type { BondStyle, RingKind } from "@structura/core/types"
import { TOOL_NAMES } from "../i18n/zh.ts"
import { toolLabel } from "./catalog.ts"
import type { ToolId } from "./types.ts"

/**
 * What a key does when the pointer is not over an atom or bond: pick a tool, and for the
 * bond and ring tools, which kind. Letters match either case unless an upper-case entry
 * exists (W is the hashed wedge, w the solid one), mirroring the hover keys on bonds.
 */
export type ToolKey =
  | { key: string; tool: "bond"; style: BondStyle }
  | { key: string; tool: "ring"; ring: RingKind }
  | { key: string; tool: Exclude<ToolId, "bond" | "ring"> }
  | { key: string; tool: "ring-current" }

export const TOOL_KEYS: ToolKey[] = [
  { key: "v", tool: "lasso" },
  { key: "m", tool: "marquee" },
  { key: "k", tool: "chain" },
  { key: "e", tool: "eraser" },
  { key: "b", tool: "bond", style: { order: 1, stereo: "none" } },
  { key: "x", tool: "bond", style: { order: 1, stereo: "none" } },
  { key: "1", tool: "bond", style: { order: 1, stereo: "none" } },
  { key: "2", tool: "bond", style: { order: 2, stereo: "none" } },
  { key: "3", tool: "bond", style: { order: 3, stereo: "none" } },
  { key: "z", tool: "bond", style: { order: 3, stereo: "none" } },
  { key: "w", tool: "bond", style: { order: 1, stereo: "up" } },
  { key: "W", tool: "bond", style: { order: 1, stereo: "down" } },
  { key: "y", tool: "bond", style: { order: 1, stereo: "either" } },
  { key: "r", tool: "ring-current" },
  { key: "j", tool: "ring", ring: "benzene" },
  { key: "a", tool: "ring", ring: "benzene" },
  { key: "t", tool: "ring", ring: "cyclopropane" },
  { key: "4", tool: "ring", ring: "cyclobutane" },
  { key: "5", tool: "ring", ring: "cyclopentane" },
  { key: "6", tool: "ring", ring: "cyclohexane" },
  { key: "7", tool: "ring", ring: "cycloheptane" },
  { key: "8", tool: "ring", ring: "cyclooctane" },
  // With atoms selected it also brackets them, as the palette's button does (see takeBracketTool).
  { key: "[", tool: "bracket" },
]

/** What a tool key picks, in words: the palette's name for that tool, bond or ring. */
export function toolKeyLabel(entry: ToolKey): string {
  if (entry.tool === "ring-current") return TOOL_NAMES["ring-current"]
  return toolLabel(entry.tool, { bondStyle: entry.tool === "bond" ? entry.style : undefined, ringKind: entry.tool === "ring" ? entry.ring : undefined })
}

export function toolForKey(key: string): ToolKey | undefined {
  return TOOL_KEYS.find((entry) => entry.key === key) ?? TOOL_KEYS.find((entry) => entry.key === key.toLowerCase() && !TOOL_KEYS.some((other) => other.key === key))
}

/** The keys that pick a given bond style or ring, for tooltips: "X / 1". */
export function keysFor(match: (entry: ToolKey) => boolean): string {
  return TOOL_KEYS.filter(match)
    .map((entry) => (entry.key.length === 1 && entry.key !== entry.key.toLowerCase() ? `⇧${entry.key}` : entry.key.toUpperCase()))
    .join(" / ")
}

/** The label with its keys, "label (J / A)", or just the label when no key picks it. */
export function withKeys(label: string, keys: string): string {
  return keys ? `${label} (${keys})` : label
}
