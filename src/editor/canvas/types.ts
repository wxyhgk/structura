import type { DrawOptions } from "@structura/core/draw"
import type { Arrow, Attachment, BondStyle, Drawing, Molecule, RingKind, Selection } from "@structura/core/types"
import type { HoverTarget, Run, ScaffoldPick, ToolId, Viewport } from "@structura/engine"

export type CanvasHandle = {
  /** Hover hotkeys; returns whether the key was used. */
  handleKey: (event: KeyboardEvent) => boolean
  /** Space went down: pointer drags pan until it is released. */
  holdSpace: () => void
  /** Space came up; a tap that did not pan selects the molecule under the hotspot. */
  releaseSpace: () => void
  cancelGesture: () => void
  hasGesture: () => boolean
  hotspot: () => { type: "atom" | "bond"; id: number } | null
  /** The atom or bond under the pointer right now (not a pinned hotspot), if any. */
  pointed: () => HoverTarget
  focusAtom: (id: number) => void
  /** Opens the quick template field by the pointer, acting on what the pointer (or hotspot) is on now. */
  quickScaffold: () => void
  /** Opens a field on the fragment made of these atoms; what is typed replaces it. */
  replaceFragment: (ids: number[]) => void
}

export type EditorSlice = {
  mol: Molecule
  arrows: Arrow[]
  tool: ToolId
  bondStyle: BondStyle
  ringKind: RingKind
  scaffold: ScaffoldPick
  atomEl: string
  selection: Selection
  colorHetero: boolean
  /** How labels are written (raised variable numbers or not). */
  drawOptions: DrawOptions
  /** The generic formula's variable points of attachment, drawn as lines into rings. */
  attachments?: Attachment[]
  /** Applies ops to the latest drawing and commits them; see useEditor. */
  run: Run
  /** The drawing as of the last edit, ahead of the re-render when keys come fast. */
  latest: () => Drawing
  setSelection: (selection: Selection) => void
  /** Takes back the last edit; a double click uses it to drop what its first press drew. */
  undo: () => void
  viewport: Viewport
}

export type { Gesture, PointerHost, Preview } from "@structura/engine"
export type { HoverTarget }
