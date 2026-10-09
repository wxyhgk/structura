import type { FrameHandle } from "@structura/engine"

/** The CSS cursor over a selection-frame handle: a hand to turn it, a resize arrow along the side or corner's axis. */
export function frameHandleCursor(kind: FrameHandle): string {
  if (kind === "rotate") return "grab"
  if (kind === "n" || kind === "s") return "ns-resize"
  if (kind === "e" || kind === "w") return "ew-resize"
  if (kind === "ne" || kind === "sw") return "nesw-resize"
  return "nwse-resize"
}
