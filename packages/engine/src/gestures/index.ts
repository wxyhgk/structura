import type { Point } from "@structura/core/types"
import { bracketAt } from "../pointer/brackets.ts"
import { hitOf } from "../pointer/targeting.ts"
import { bond, startBond } from "./bond.ts"
import { chain, startChain } from "./chain.ts"
import { clickTool } from "./click.ts"
import { hover } from "./hover.ts"
import { lasso, marquee, pressBracket, pressEmpty, pressOn } from "./select.ts"
import { move, rotate, scale, startFrameGesture } from "./transform.ts"
import type { Gesture, GestureKind, PointerHost, PointerInput } from "./types.ts"

type Pan = Extract<Gesture, { kind: "pan" }>

/** Dragging the view: it follows the pointer. */
const pan: GestureKind<Pan> = {
  move(host, gesture, _world, event) {
    host.setView(host.zoom(), { x: gesture.pan.x + (event.clientX - gesture.clientX), y: gesture.pan.y + (event.clientY - gesture.clientY) })
  },
  up(host) {
    if (!host.space.current) host.setPanning(false)
  },
}

/** Each kind of drag, by name: what moving and letting go do. */
const KINDS: { [K in Exclude<Gesture["kind"], "idle">]: GestureKind<Extract<Gesture, { kind: K }>> } = { bond, chain, move, rotate, scale, marquee, lasso, pan }

/**
 * A press: the middle button or Space pans; otherwise the frame's handles, then the tools
 * that act on a click, then the drawing tools' drags, then selecting (and moving) what was
 * pressed, then a box or lasso on empty canvas. Whatever starts is kept in `host.gesture`.
 */
export function pointerDown(host: PointerHost, event: PointerInput) {
  if (event.button === 1 || host.space.current) {
    host.gesture.current = { kind: "pan", clientX: event.clientX, clientY: event.clientY, pan: { ...host.pan() } }
    host.setPanning(true)
    return
  }
  if (event.button !== 0) return
  const started = startPress(host, host.toWorld(event.clientX, event.clientY), event)
  if (started) host.gesture.current = started
}

/** What a left press starts, in order of who gets it first; null when it was a click and is done. */
function startPress(host: PointerHost, world: Point, event: PointerInput): Gesture | null {
  const { mol, tool } = host.props
  const hit = hitOf(mol, world, host.zoom())
  if (tool === "lasso" || tool === "marquee") {
    const onFrame = startFrameGesture(host, world)
    if (onFrame) return onFrame
    const bracket = hit ? null : bracketAt(mol, host.props.brackets, world, host.zoom())
    if (bracket) return pressBracket(host, bracket.atoms, world, event.shiftKey)
  }
  if (clickTool(host, hit, world)) return null
  if (tool === "bond") return startBond(host, hit, world, event)
  if (tool === "chain") return startChain(host, hit, world)
  return hit ? pressOn(host, hit, world, event.shiftKey) : pressEmpty(host, world, event.shiftKey)
}

/** The pointer moving: the drag in progress follows it; with none, the hover does. */
export function pointerMove(host: PointerHost, event: PointerInput) {
  const world = host.toWorld(event.clientX, event.clientY)
  const current = host.gesture.current
  if (current.kind === "idle") return hover(host, world)
  ;(KINDS[current.kind] as GestureKind<Gesture>).move(host, current, world, event)
}

/** Letting go: the drag in progress makes its edit, and the canvas is idle again. */
export function pointerUp(host: PointerHost, event: PointerInput) {
  host.setRingHint(null)
  const current = host.gesture.current
  host.gesture.current = { kind: "idle" }
  if (current.kind === "idle") return
  ;(KINDS[current.kind] as GestureKind<Gesture>).up(host, current, host.toWorld(event.clientX, event.clientY), event)
}
