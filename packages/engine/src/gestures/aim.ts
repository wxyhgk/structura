import type { Point } from "@structura/core/types"
import { aimAt, type Aimed } from "../pointer/aim.ts"
import type { PointerHost, PointerInput } from "./types.ts"

/**
 * What the pointer aims at for the tool in hand: atoms and bonds always, custom curves with
 * the select tools, brackets with those and the bracket tool. A finger reaches further, and on
 * a boundary the pointer stays on what the hover marked.
 */
export function aimOf(host: PointerHost, world: Point, event?: Pick<PointerInput, "pointerType">): Aimed {
  const { mol, tool, attachments, brackets } = host.props
  const selecting = tool === "lasso" || tool === "marquee"
  return aimAt({ mol, attachments, brackets }, world, host.zoom(), {
    coarse: event?.pointerType === "touch",
    keep: host.hovered?.() ?? null,
    with: { curves: selecting, brackets: selecting || tool === "bracket" },
  })
}
