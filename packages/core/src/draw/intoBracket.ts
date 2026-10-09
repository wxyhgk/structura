import type { Point } from "../types.ts"

// A bond drawn into a group bracket, "L joined at any position of the bracketed group": it
// crosses the near upright and ends a little inside, on no atom.

/** How far past the upright the bond ends, in bond lengths. */
const PAST = 0.4
/** How near the ends of an upright (its serifs) the bond may cross it, in bond lengths. */
const CLEAR = 0.45

/** Where a bracket's uprights stand: their x (left, right) and how far they reach (top, bottom). */
export type Uprights = { left: number; right: number; top: number; bottom: number }

/**
 * Where a bond from `from` into the bracket ends. From beside the bracket it runs level
 * when the atom is level with the upright (as patents draw it), else slanting to cross the
 * upright clear of its serifs; from above or below, it runs towards the middle and ends as
 * far inside the bracket's top or bottom. `length` is the bond length there.
 */
export function intoBracketEnd(from: Point, frame: Uprights, length: number): Point {
  const clear = Math.min(CLEAR * length, (frame.bottom - frame.top) / 2)
  const side = from.x > frame.right ? 1 : from.x < frame.left ? -1 : 0
  if (side !== 0) {
    const x = side > 0 ? frame.right : frame.left
    const y = Math.max(frame.top + clear, Math.min(frame.bottom - clear, from.y))
    // Carried on past the upright along the same line, PAST further in x.
    const t = (x - side * PAST * length - from.x) / (x - from.x)
    return { x: from.x + (x - from.x) * t, y: from.y + (y - from.y) * t }
  }
  const middle = { x: (frame.left + frame.right) / 2, y: (frame.top + frame.bottom) / 2 }
  const edge = from.y < middle.y ? frame.top : frame.bottom
  const y = edge + (from.y < middle.y ? 1 : -1) * PAST * length
  const t = (y - from.y) / (middle.y - from.y || 1)
  return { x: from.x + (middle.x - from.x) * t, y }
}
