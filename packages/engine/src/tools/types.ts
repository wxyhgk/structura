import type { AttachmentShape } from "@structura/markush"
import type { BondStyle, Bracket, RingKind } from "@structura/core/types"

/** The drawing tool picked in the palette or by a tool key. */
export type ToolId =
  | "lasso"
  | "marquee"
  | "bond"
  | "chain"
  | "ring"
  | "eraser"
  | "charge-plus"
  | "charge-minus"
  | "atom"
  /** Places a scaffold template (see ScaffoldPick). */
  | "scaffold"
  /** Square brackets round the atoms in a dragged box (or the selection), of the kind picked. */
  | "bracket"
  /** A variable attachment: dragged from an atom across the rings it may hang from. */
  | "attach"

/**
 * The scaffold the template tool places, and how: clicking empty canvas puts it there,
 * clicking an atom joins it there by `site` ("N9"), clicking a bond fuses it by `edge` ("b").
 */
export type ScaffoldPick = { name: string; site: string; edge: string }

/**
 * What the tools draw: the bond style, ring kind, element and scaffold, the kind of bracket
 * the bracket tool puts round atoms, and how the attachment tool draws a new attachment
 * (null lets the drawing choose).
 */
export type ToolSettings = {
  bondStyle: BondStyle
  ringKind: RingKind
  atomEl: string
  scaffold: ScaffoldPick
  bracketKind: Bracket["kind"]
  attachShape: AttachmentShape | null
}
