import type { Arrow, Attachment, BondStyle, Drawing, Molecule, Point, RingKind, Selection } from "@structura/core/types"
import type { ScaffoldPick, ToolId } from "@/editor/tools/types"
import type { Viewport } from "@/editor/canvas/viewport"
import type { RingHintShape } from "@/editor/markush/hints"
import type { Run } from "@/editor/ops"

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

export type Gesture =
  | { kind: "idle" }
  | {
      kind: "bond"
      mol: Molecule
      fromId: number | null
      origin: Point
      clientX: number
      clientY: number
      moved: boolean
      style: BondStyle
    }
  | { kind: "chain"; mol: Molecule; fromId: number | null; origin: Point }
  | { kind: "move"; mol: Molecule; ids: number[]; origin: Point }
  | { kind: "marquee"; origin: Point; base: Selection; additive: boolean }
  | { kind: "lasso"; points: Point[]; base: Selection; additive: boolean }
  | { kind: "pan"; clientX: number; clientY: number; pan: Point }
  | { kind: "rotate"; mol: Molecule; ids: number[]; center: Point; startAngle: number }
  | {
      kind: "scale"
      mol: Molecule
      ids: number[]
      center: Point
      anchor: "n" | "s" | "e" | "w" | "nw" | "ne" | "se" | "sw"
      origin: Point
    }

export type Preview =
  | null
  | { kind: "bond"; a: Point; b: Point; style: BondStyle }
  | { kind: "chain"; points: Point[] }
  | { kind: "ring"; points: Point[]; doubles: boolean; anchor?: Point }
  | { kind: "marquee"; a: Point; b: Point }
  | { kind: "lasso"; points: Point[] }
  /** A bond dragged into a ring: it will attach at any of `positions`, meeting the ring at `centre`. */
  | { kind: "attachment"; a: Point; centre: Point; positions: Point[] }

export type HoverTarget = { type: "atom" | "bond"; id: number } | null

export type PointerHost = {
  props: EditorSlice
  gesture: { current: Gesture }
  space: { current: boolean }
  zoom: () => number
  pan: () => Point
  toWorld: (clientX: number, clientY: number) => Point
  setView: (zoom: number, pan: Point) => void
  setPreview: (preview: Preview) => void
  setDraft: (mol: Molecule | null) => void
  setPanning: (panning: boolean) => void
  assignHover: (hover: HoverTarget) => void
  setCursor: (cursor: string | null) => void
  setRotating: (rotating: boolean) => void
  /** Where a line being drawn into a ring will attach, or null. */
  setRingHint: (hint: RingHintShape | null) => void
}
