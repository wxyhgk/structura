import type { Arrow, BondStyle, Molecule, Point, RingKind, Selection, ToolId } from "@/chem/types"

export type CanvasHandle = {
  zoomBy: (factor: number) => void
  resetView: () => void
  /** Zooms and pans so the whole drawing fits in view; pass a molecule not yet rendered. */
  fitContent: (mol?: Molecule) => void
  cancelGesture: () => void
  hasGesture: () => boolean
  hotspot: () => { type: "atom" | "bond"; id: number } | null
  focusAtom: (id: number) => void
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
  commit: (mol: Molecule, keepSelection?: boolean) => void
  setSelection: (selection: Selection) => void
  onZoom: (zoom: number) => void
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
