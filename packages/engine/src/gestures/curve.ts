import { emptySelection } from "@structura/core/molecule"
import type { Point } from "@structura/core/types"
import { curveOp, withNodes, withoutNode } from "../markush/curveEdit.ts"
import { curveAt, customMarks, nodeAt, pathAt, type CustomMark } from "../pointer/curves.ts"
import type { hitOf } from "../pointer/targeting.ts"
import type { CurveHover, Gesture, GestureKind, PointerHost, PointerInput } from "./types.ts"

// Editing a custom attachment curve with the select tools: a click on the curve picks it and
// shows its nodes; a node is dragged where it should go; a click on the picked curve between
// nodes puts one in there (dragging on at once moves it); a double click on a node takes it out.

type CurveNode = Extract<Gesture, { kind: "curveNode" }>

/** How far (screen px) a press must travel before it counts as a drag. */
const DRAG_SLOP = 3
/** Two clicks on one node this close together (ms) take it out. */
const DOUBLE_CLICK_MS = 500

/** The last plain click on a node, to tell a double click. */
let lastClick: { atom: number; index: number; time: number } | null = null

const marksOf = (host: PointerHost) => customMarks(host.props.mol, host.props.attachments, host.props.brackets)

/** Where node `index` of the dragged curve is with the pointer at `world`. */
function dragged(gesture: CurveNode, world: Point): Point[] {
  const nodes = [...gesture.nodes]
  nodes[gesture.index] = { x: gesture.start.x + world.x - gesture.origin.x, y: gesture.start.y + world.y - gesture.origin.y }
  return nodes
}

/** Dragging a node (or one just put in): the curve follows, shown until let go, then one undoable edit. */
export const curveNode: GestureKind<CurveNode> = {
  move(host, gesture, world) {
    if (!gesture.moved && Math.hypot(world.x - gesture.origin.x, world.y - gesture.origin.y) * host.zoom() < DRAG_SLOP) return
    gesture.moved = true
    const { mol, attachments } = host.props
    host.setAttachmentsDraft(withNodes(mol, attachments ?? [], gesture.atom, dragged(gesture, world), gesture.closed))
  },
  up(host, gesture, world, event) {
    host.setAttachmentsDraft(null)
    const { atom, index, closed } = gesture
    if (gesture.moved || gesture.inserted) {
      host.props.run([curveOp(atom, gesture.moved ? dragged(gesture, world) : gesture.nodes, closed)], { keepSelection: true })
      host.props.setCurveFocus({ atom, node: index })
      lastClick = null
      return
    }
    const time = event.timeStamp ?? Date.now()
    if (lastClick && lastClick.atom === atom && lastClick.index === index && time - lastClick.time <= DOUBLE_CLICK_MS) {
      lastClick = null
      const fewer = withoutNode(gesture.nodes, index, closed)
      if (fewer) host.props.run([curveOp(atom, fewer, closed)], { keepSelection: true })
      host.props.setCurveFocus({ atom, node: null })
      return
    }
    lastClick = { atom, index, time }
  },
}

/** What a press with a select tool does to custom curves: a gesture, "done" when it only picked one, or null when it is not on any. */
export function pressCurve(host: PointerHost, world: Point, hit: ReturnType<typeof hitOf>, event: PointerInput): Gesture | "done" | null {
  const { curveFocus, setCurveFocus } = host.props
  const zoom = host.zoom()
  const marks = marksOf(host)
  const focused = curveFocus ? marks.find((mark) => mark.atom === curveFocus.atom) : undefined
  if (focused && !event.shiftKey) {
    const node = nodeAt(focused, world, zoom)
    if (node != null) {
      setCurveFocus({ atom: focused.atom, node })
      return start(focused, node, focused.custom.nodes, world, false)
    }
    const on = hit ? null : pathAt(focused, world, zoom)
    if (on && on.insertAt != null) {
      lastClick = null
      const nodes = [...focused.custom.nodes]
      nodes.splice(on.insertAt, 0, on.point)
      setCurveFocus({ atom: focused.atom, node: on.insertAt })
      return start(focused, on.insertAt, nodes, world, true)
    }
  }
  const picked = hit ? null : curveAt(marks, world, zoom)
  if (picked) {
    host.props.setSelection(emptySelection())
    setCurveFocus({ atom: picked.atom, node: null })
    return "done"
  }
  if (curveFocus) setCurveFocus(null)
  return null
}

function start(mark: CustomMark, index: number, nodes: Point[], world: Point, inserted: boolean): Gesture {
  return { kind: "curveNode", atom: mark.atom, index, nodes, closed: mark.custom.closed, origin: world, start: nodes[index], moved: false, inserted }
}

/** What the pointer is over, for the cursor: a node of the picked curve, the picked curve (a click puts a node in), or a curve to pick. */
export function curveHover(host: PointerHost, world: Point, hit: ReturnType<typeof hitOf>): CurveHover {
  const { curveFocus } = host.props
  const marks = marksOf(host)
  if (marks.length === 0) return null
  const zoom = host.zoom()
  const focused = curveFocus ? marks.find((mark) => mark.atom === curveFocus.atom) : undefined
  if (focused && nodeAt(focused, world, zoom) != null) return "node"
  if (hit) return null
  if (focused && pathAt(focused, world, zoom)?.insertAt != null) return "insert"
  return curveAt(marks, world, zoom) ? "pick" : null
}
