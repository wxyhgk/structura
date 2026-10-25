import type { Point } from "@structura/core/types"
import { clampZoom, type View } from "../view/viewport.ts"
import type { PointerHost, PointerInput } from "./types.ts"

/** A pointer event with the id that tells one finger from another. */
export type FingerInput = PointerInput & { pointerId: number }

/**
 * What the fingers drive: the one-pointer gestures (press, move, release, as the canvas
 * hands them to pointerDown and the rest), dropping the one in progress, and the view.
 */
export type FingerHost<E extends FingerInput> = Pick<PointerHost, "zoom" | "pan" | "toWorld" | "setView"> & {
  press: (event: E) => void
  move: (event: E) => void
  release: (event: E) => void
  /** Drops the gesture in progress, its preview and draft, with no edit. */
  cancel: () => void
}

/** How far (px) a lone finger moves before it is a drag rather than the first of two fingers. */
const TOUCH_SLOP = 8

/** Two fingers as they went down: the view then, and the drawing point between them. */
type Pinch = { ids: [number, number]; from: [Point, Point]; view: View; world: Point }

const middle = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/**
 * The view as two fingers move it: their spread scales the zoom, and the drawing point that
 * was between them stays between them, so they pan and pinch at once. `world` is the drawing
 * point under the middle of `from` in `start`; points are client coordinates.
 */
export function pinchedView(start: View, world: Point, from: [Point, Point], to: [Point, Point]): View {
  const spread = Math.hypot(from[1].x - from[0].x, from[1].y - from[0].y)
  const factor = spread < 1 ? 1 : Math.hypot(to[1].x - to[0].x, to[1].y - to[0].y) / spread
  const zoom = clampZoom(start.zoom * factor)
  const [a, b] = [middle(...from), middle(...to)]
  // The canvas's offset on the page drops out: pan moves with the middle, less the zoom's growth about the origin.
  return { zoom, pan: { x: start.pan.x + b.x - a.x - world.x * (zoom - start.zoom), y: start.pan.y + b.y - a.y - world.y * (zoom - start.zoom) } }
}

/**
 * Sorts touches into one-finger gestures and two-finger views; a mouse or pen goes straight
 * through. A finger's press is held back until it moves past a slop or lifts: a second finger
 * down by then means it was a pinch, and nothing was drawn (a click tool acts on press, and
 * that would be in the history). A second finger down during a drag drops the drag. Once two
 * fingers were down, those left draw nothing: a finger draws only if it went down alone.
 */
export function createFingers<E extends FingerInput>() {
  /** Where each finger on the canvas is now, in the order they went down. */
  const down = new Map<number, Point>()
  /** A lone finger's press not yet handed on. */
  let held: E | null = null
  /** The finger whose press was handed on: its moves and release go to the gestures. */
  let drawing: number | null = null
  let pinch: Pinch | null = null

  const touch = (event: E) => event.pointerType === "touch"

  /** The first two fingers down start (or, after one lifts, restart) the pinch from here. */
  function startPinch(host: FingerHost<E>) {
    const fingers = [...down].slice(0, 2)
    if (fingers.length < 2) {
      pinch = null
      return
    }
    const from: [Point, Point] = [fingers[0][1], fingers[1][1]]
    const at = middle(...from)
    pinch = { ids: [fingers[0][0], fingers[1][0]], from, view: { zoom: host.zoom(), pan: host.pan() }, world: host.toWorld(at.x, at.y) }
  }

  /** A finger lifted or lost: a pinch it was in goes on with the next two fingers, if there are two. */
  function lift(host: FingerHost<E>, id: number) {
    down.delete(id)
    if (pinch?.ids.includes(id)) startPinch(host)
  }

  return {
    down(host: FingerHost<E>, event: E) {
      if (!touch(event)) return host.press(event)
      down.set(event.pointerId, { x: event.clientX, y: event.clientY })
      // Only a finger down alone may draw; one left over from a pinch never had a press to hand on.
      if (down.size === 1) {
        held = event
        return
      }
      if (drawing != null) host.cancel()
      held = null
      drawing = null
      if (!pinch) startPinch(host)
    },
    move(host: FingerHost<E>, event: E) {
      if (!touch(event)) return host.move(event)
      if (!down.has(event.pointerId)) return
      if (held?.pointerId === event.pointerId) {
        if (Math.hypot(event.clientX - held.clientX, event.clientY - held.clientY) <= TOUCH_SLOP) return
        host.press(held)
        held = null
        drawing = event.pointerId
      }
      down.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (drawing === event.pointerId) return host.move(event)
      if (!pinch?.ids.includes(event.pointerId)) return
      const view = pinchedView(pinch.view, pinch.world, pinch.from, [down.get(pinch.ids[0])!, down.get(pinch.ids[1])!])
      host.setView(view.zoom, view.pan)
    },
    up(host: FingerHost<E>, event: E) {
      if (!touch(event)) return host.release(event)
      if (!down.has(event.pointerId)) return
      // A tap: the press held back is handed on now, with its release.
      if (held?.pointerId === event.pointerId) {
        host.press(held)
        held = null
        drawing = event.pointerId
      }
      if (drawing === event.pointerId) {
        drawing = null
        host.release(event)
      }
      lift(host, event.pointerId)
    },
    /** The browser took the pointer away (pointercancel): its gesture goes with no edit. */
    cancel(host: FingerHost<E>, event: E) {
      if (!touch(event)) return host.cancel()
      if (held?.pointerId === event.pointerId) held = null
      if (drawing === event.pointerId) {
        drawing = null
        host.cancel()
      }
      lift(host, event.pointerId)
    },
  }
}

export type Fingers<E extends FingerInput> = ReturnType<typeof createFingers<E>>
