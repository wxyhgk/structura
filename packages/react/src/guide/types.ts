import type { ReactNode } from "react"
import type { Op } from "@structura/core/ops"
import type { Drawing, Molecule } from "@structura/core/types"
import type { Mark } from "./figures/marks.ts"

/** What pressing `key` while hovering atom `atom` does, as ops: the host editor's key table. */
export type PressKey = (mol: Molecule, atom: number, key: string) => Op[] | null

/**
 * What the guide needs from the editor it sits in, handed in so the guide never reaches
 * into the editor: how the modifier key is written, its key table (for pictures of key
 * presses), a way to open its full shortcut table, and props its dialogs must carry.
 */
export type GuideHost = {
  /** "⌘" on a Mac, "Ctrl" elsewhere. */
  mod: string
  pressKey: PressKey
  openShortcuts: () => void
  /** Spread on the dialog's content (the editor uses it to keep keys inside the dialog). */
  contentProps?: Record<string, unknown>
}

/** What a page's body gets to work with. */
export type GuideContext = Pick<GuideHost, "mod" | "pressKey" | "openShortcuts">

/** One page of the guide. Write it in pages/, list it in pages/index.ts. */
export type Page = {
  id: string
  /** The heading it is listed under on the left. */
  group: string
  title: string
  /** Extra words to find the page by, besides its title and group. */
  keywords: string
  body: (context: GuideContext) => ReactNode
}

/** A page, its id kept as the literal it is, so the topics can be typed from the list. */
export function definePage<const T extends Page>(page: T): T {
  return page
}

/** A small stand-in for a variable's card in the 通式 workspace, to show what a step sets there. */
export type CardSketch = { name: string; chips: string[]; note?: string }

export type TutorialStep = {
  /** What to do, in a sentence or two; keys in square brackets ("按 [1]") show as keys. */
  text: string
  /** The drawing as it looks once this step is done (or, with marks, just before). */
  drawing: Drawing
  marks?: Mark[]
  card?: CardSketch
}
