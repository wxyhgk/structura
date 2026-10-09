import type { DrawOptions } from "@structura/core/draw"
import type { Arrow, BondStyle, Bracket, Drawing, Molecule, RingKind, Selection } from "@structura/core/types"
import type { Attachment } from "@structura/markush"
import type { CurveFocus, HoverTarget, Run, ScaffoldPick, ToolId, ToolSettings, Viewport } from "@structura/engine"

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
  /** Opens the label field on an atom, as a double click does. */
  editLabel: (id: number) => void
  /** The atom or bond at a point on the screen (client coordinates), as shown; null for empty canvas. */
  targetAt: (clientX: number, clientY: number) => HoverTarget
  /** The id of the bracket whose stroke is at a point on the screen (client coordinates), or null. */
  bracketAt: (clientX: number, clientY: number) => number | null
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
  bracketKind: ToolSettings["bracketKind"]
  attachShape: ToolSettings["attachShape"]
  selection: Selection
  /** The custom attachment curve whose nodes are shown for editing, and the node picked on it. */
  curveFocus: CurveFocus | null
  colorHetero: boolean
  /** How labels are written (raised variable numbers or not). */
  drawOptions: DrawOptions
  /** The generic formula's variable points of attachment, drawn as lines into rings. */
  attachments?: Attachment[]
  /** Square brackets round parts of the structure, drawn from their atoms. */
  brackets?: Bracket[]
  /** Applies ops to the latest drawing and commits them; see useEditor. */
  run: Run
  /** The drawing as of the last edit, ahead of the re-render when keys come fast. */
  latest: () => Drawing
  setSelection: (selection: Selection) => void
  setCurveFocus: (focus: CurveFocus | null) => void
  /** Takes back the last edit; a double click uses it to drop what its first press drew. */
  undo: () => void
  viewport: Viewport
}

export type { Gesture, PointerHost, Preview } from "@structura/engine"
export type { HoverTarget }
