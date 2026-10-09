import { createContext, useContext } from "react"
import type { DrawOptions } from "@structura/core/draw"
import type { Editor } from "@structura/engine"

/** A sketch pad that is open: its editor, and what to do when a tool is picked for it. */
export type Pad = { editor: Editor; onPick: () => void }

/**
 * The editor's one tool palette, lent to a sketch pad while it is open, and the main
 * canvas's look (colours, labels), so a pad draws like the main canvas does.
 */
export type PadSlot = {
  /** Points the palette at the pad; the returned function hands it back. */
  claim: (pad: Pad) => () => void
  colorHetero: boolean
  drawOptions: DrawOptions
}

export const PadSlotContext = createContext<PadSlot | null>(null)

/** The slot of the editor around, or null for a pad shown on its own. */
export const usePadSlot = () => useContext(PadSlotContext)
