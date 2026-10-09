import { ringPointerAt } from "@structura/markush"
import { atomById, moveAtoms, rotateAtoms, scaleAtoms } from "@structura/core/molecule"
import { angleTo, dist, signedDelta, snapAngle } from "@structura/core/geometry"
import type { Point } from "@structura/core/types"
import { snappedMove } from "../pointer/moveSnap.ts"
import { clampScale, frameAt, selectionFrame } from "../pointer/targeting.ts"
import { ringHint } from "./hints.ts"
import type { Gesture, GestureKind, PointerHost } from "./types.ts"

type Move = Extract<Gesture, { kind: "move" }>
type Rotate = Extract<Gesture, { kind: "rotate" }>
type Scale = Extract<Gesture, { kind: "scale" }>

function scaleFactors(gesture: Scale, pointer: Point): [number, number] {
  const { anchor, center, origin } = gesture
  if (anchor === "e" || anchor === "w") {
    const span = origin.x - center.x
    if (Math.abs(span) < 1) return [1, 1]
    return [clampScale((pointer.x - center.x) / span), 1]
  }
  if (anchor === "n" || anchor === "s") {
    const span = origin.y - center.y
    if (Math.abs(span) < 1) return [1, 1]
    return [1, clampScale((pointer.y - center.y) / span)]
  }
  const base = dist(origin, center)
  if (base < 1) return [1, 1]
  const scale = clampScale(dist(pointer, center) / base)
  return [scale, scale]
}

/** The angle a rotate drag has turned, snapped to 15° steps unless Alt is held. */
function turned(gesture: Rotate, world: Point, free: boolean): number {
  const raw = signedDelta(gesture.startAngle, angleTo(gesture.center, world))
  return free ? raw : snapAngle(raw)
}

/** Dragging atoms: they follow the pointer, snap onto an atom they come near, and join it on letting go. */
export const move: GestureKind<Move> = {
  move(host, gesture, world) {
    // Near an atom that stays, the drag snaps onto it: letting go joins them.
    const { dx, dy, target } = snappedMove(gesture.mol, gesture.ids, world.x - gesture.origin.x, world.y - gesture.origin.y, host.zoom())
    host.setDraft(moveAtoms(gesture.mol, gesture.ids, dx, dy))
    host.assignHover(target != null ? { type: "atom", id: target } : null)
    // A line's end dragged into a ring will attach there.
    const end = gesture.ids.length === 1 ? atomById(gesture.mol, gesture.ids[0]) : undefined
    const positions = end ? ringPointerAt(gesture.mol, end.id, { x: end.x + dx, y: end.y + dy }) : null
    host.setRingHint(positions ? ringHint(gesture.mol, positions) : null)
  },
  up(host, gesture, world) {
    const { dx, dy } = snappedMove(gesture.mol, gesture.ids, world.x - gesture.origin.x, world.y - gesture.origin.y, host.zoom())
    if (dx !== 0 || dy !== 0) host.props.run([{ op: "move", atoms: gesture.ids, dx, dy, ringPointer: true, join: true }], { keepSelection: true })
    host.setDraft(null)
  },
}

/** Dragging the selection frame's top handle: the selection turns about its centre. */
export const rotate: GestureKind<Rotate> = {
  move(host, gesture, world, event) {
    host.setDraft(rotateAtoms(gesture.mol, gesture.ids, gesture.center, turned(gesture, world, event.altKey)))
  },
  up(host, gesture, world, event) {
    const angle = turned(gesture, world, event.altKey)
    if (angle !== 0) host.props.run([{ op: "rotate", atoms: gesture.ids, angle, center: gesture.center }], { keepSelection: true })
    host.setDraft(null)
    host.setFrameHandle(null)
    host.setRotating(false)
  },
}

/** Dragging a corner or side handle: the selection scales, evenly or along one axis. */
export const scale: GestureKind<Scale> = {
  move(host, gesture, world) {
    host.setDraft(scaleAtoms(gesture.mol, gesture.ids, gesture.center, ...scaleFactors(gesture, world)))
  },
  up(host, gesture, world) {
    const [sx, sy] = scaleFactors(gesture, world)
    if (sx !== 1 || sy !== 1) host.props.run([{ op: "scale", atoms: gesture.ids, sx, sy, center: gesture.center }], { keepSelection: true })
    host.setDraft(null)
    host.setFrameHandle(null)
  },
}

/** A press on the selection frame's handles starts turning or scaling it; null anywhere else. */
export function startFrameGesture(host: PointerHost, world: Point): Gesture | null {
  const { mol, selection } = host.props
  const zoom = host.zoom()
  const frame = selectionFrame(mol, selection)
  const which = frame ? frameAt(frame, world, zoom) : null
  if (!frame || !which) return null
  if (which === "rotate") {
    host.assignHover(null)
    host.setFrameHandle(which)
    host.setRotating(true)
    return { kind: "rotate", mol, ids: frame.ids, center: frame.center, startAngle: angleTo(frame.center, world) }
  }
  const handle = frame.handles.find((item) => item.kind === which)
  if (!handle) return null
  host.assignHover(null)
  host.setFrameHandle(which)
  return { kind: "scale", mol, ids: frame.ids, center: frame.center, anchor: which, origin: { x: handle.x, y: handle.y } }
}
