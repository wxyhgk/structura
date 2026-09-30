import type { Arrow, BondStyle, Drawing, Molecule, Point, RingKind, Selection } from "@/chem/types"
import type { ToolId } from "@/editor/tools/types"
import type { Viewport } from "@/editor/canvas/viewport"
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
  focusAtom: (id: number) => void
  /** Opens a field on the fragment made of these atoms; what is typed replaces it. */
  replaceFragment: (ids: number[]) => void
}

export type EditorSlice = {
  mol: Molecule
  arrows: Arrow[]
  tool: ToolId
  bondStyle: BondStyle
  ringKind: RingKind
  atomEl: string
  selection: Selection
  colorHetero: boolean
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
}
