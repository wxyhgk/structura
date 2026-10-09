import type { Attachment, AttachmentShape } from "@structura/markush"
import type { BondStyle, Bracket, Molecule, Point, RingKind, Selection } from "@structura/core/types"
import type { CurveFocus } from "../markush/curveEdit.ts"
import type { Run } from "../ops/builders.ts"
import type { FrameHandle } from "../pointer/targeting.ts"
import type { HoverTarget } from "../pointer/types.ts"
import type { ScaffoldPick, ToolId } from "../tools/types.ts"
import type { RingHintShape } from "./hints.ts"

/** What a drag in progress is doing, with what it started from. */
export type Gesture =
  | { kind: "idle" }
  | { kind: "bond"; mol: Molecule; fromId: number | null; origin: Point; clientX: number; clientY: number; moved: boolean; style: BondStyle }
  | { kind: "chain"; mol: Molecule; fromId: number | null; origin: Point }
  | { kind: "move"; mol: Molecule; ids: number[]; origin: Point }
  | { kind: "marquee"; origin: Point; base: Selection; additive: boolean }
  | { kind: "lasso"; points: Point[]; base: Selection; additive: boolean }
  | { kind: "pan"; clientX: number; clientY: number; pan: Point }
  | { kind: "rotate"; mol: Molecule; ids: number[]; center: Point; startAngle: number }
  | { kind: "scale"; mol: Molecule; ids: number[]; center: Point; anchor: "n" | "s" | "e" | "w" | "nw" | "ne" | "se" | "sw"; origin: Point }
  | { kind: "bracket"; origin: Point }
  /**
   * The attachment tool's sweep. `mol` is the molecule as pressed, with the new R atom in it
   * when the press was on empty canvas (`fresh`); `from` is the atom the attachment hangs
   * from, or null when it is made where the drag ends (pressed in a ring's middle). `rings`
   * are the rings passed over so far (atoms in order, and free positions); `bracket` the
   * group bracket gone into; `path` where the pointer has been, which becomes the curve
   * when the tool draws custom curves.
   */
  | { kind: "attach"; mol: Molecule; from: number | null; fresh: boolean; origin: Point; rings: SweptRing[]; bracket: Bracket | null; path: Point[] }
  /**
   * Dragging node `index` of the custom curve on `atom`'s attachment: `nodes` as pressed
   * (with the node just put in, if `inserted`), `start` where the node was, `origin` where
   * the press was; `moved` once it went past a click.
   */
  | { kind: "curveNode"; atom: number; index: number; nodes: Point[]; closed: boolean; origin: Point; start: Point; moved: boolean; inserted: boolean }

/** A ring the attachment tool passed over: its atoms in order round it, and the free positions among them. */
export type SweptRing = { ring: number[]; positions: number[] }

/** What the canvas draws for a gesture before it is let go: a bond, a chain, a ring, a selection box… */
export type Preview =
  | null
  | { kind: "bond"; a: Point; b: Point; style: BondStyle }
  | { kind: "chain"; points: Point[] }
  | { kind: "ring"; points: Point[]; doubles: boolean; anchor?: Point }
  | { kind: "marquee"; a: Point; b: Point }
  | { kind: "lasso"; points: Point[] }
  /**
   * A bond dragged into a ring: it will attach at any of the positions `hint` marks, meeting
   * them at its centre. Into a bracket, the line stops at `end`, just past the bracket's upright.
   */
  | { kind: "attachment"; a: Point; hint: RingHintShape; end?: Point }
  /** The bracket tool's box: the atoms inside it (`atoms`) get a bracket of this kind. */
  | { kind: "bracket"; a: Point; b: Point; atoms: number[]; bracketKind: Bracket["kind"] }
  /**
   * The attachment tool's sweep: a line from `a` to the pointer `b` (or, drawing a custom
   * curve, the `trail` the pointer took), the rings passed over (outlines) and the positions
   * the attachment will choose from (`hint`, once there are any).
   */
  | { kind: "sweep"; a: Point; b: Point; rings: Point[][]; hint: RingHintShape | null; trail?: Point[] }

/** What a select tool's pointer is over on custom curves: a node of the picked one, the picked one between nodes, or one to pick. */
export type CurveHover = "node" | "insert" | "pick" | null

/** The editor as gestures see it: what is drawn, the tool settings, the selection, and the write path. */
export type GestureContext = {
  mol: Molecule
  tool: ToolId
  bondStyle: BondStyle
  ringKind: RingKind
  scaffold: ScaffoldPick
  atomEl: string
  /** The kind of bracket the bracket tool makes. */
  bracketKind: Bracket["kind"]
  /** How the attachment tool draws what it makes; null chooses by itself. */
  attachShape: AttachmentShape | null
  selection: Selection
  /** The drawing's brackets: pressing one's stroke with a select tool selects (and drags) its atoms. */
  brackets?: readonly Bracket[]
  /** The drawing's variable attachments: a bracket widens for the ellipse round its atoms. */
  attachments?: readonly Attachment[]
  /** The custom attachment curve whose nodes are shown for editing, and the node picked on it. */
  curveFocus: CurveFocus | null
  run: Run
  setSelection: (selection: Selection) => void
  setCurveFocus: (focus: CurveFocus | null) => void
}

/** A pointer event as gestures need it. */
export type PointerInput = { button: number; clientX: number; clientY: number; shiftKey: boolean; altKey: boolean; timeStamp?: number }

/**
 * Everything a gesture reads and writes outside itself: the editor, the gesture in progress,
 * whether Space holds the pan, the view, and what it shows meanwhile (preview, a moved copy
 * of the molecule, the hover, the cursor, a ring hint). The canvas provides it.
 */
export type PointerHost = {
  props: GestureContext
  gesture: { current: Gesture }
  space: { current: boolean }
  zoom: () => number
  pan: () => Point
  toWorld: (clientX: number, clientY: number) => Point
  setView: (zoom: number, pan: Point) => void
  setPreview: (preview: Preview) => void
  setDraft: (mol: Molecule | null) => void
  /** The attachments as a drag would leave them, shown instead of the drawing's until it is let go; null for the drawing's. */
  setAttachmentsDraft: (attachments: Attachment[] | null) => void
  setPanning: (panning: boolean) => void
  assignHover: (hover: HoverTarget) => void
  /** The selection-frame handle under the pointer or being dragged, for the screen to pick a cursor; null for none. */
  setFrameHandle: (handle: FrameHandle | null) => void
  /** What the pointer is over on custom curves, for the screen to pick a cursor. */
  setCurveHover: (hover: CurveHover) => void
  setRotating: (rotating: boolean) => void
  /** Where a line being drawn into a ring will attach, or null. */
  setRingHint: (hint: RingHintShape | null) => void
}

/** One kind of drag: what moving and letting go do. */
export type GestureKind<G extends Gesture> = {
  move: (host: PointerHost, gesture: G, world: Point, event: PointerInput) => void
  up: (host: PointerHost, gesture: G, world: Point, event: PointerInput) => void
}
