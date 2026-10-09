import type { Point } from "../types.ts"
import type { Cubic } from "./cubic.ts"
import { ELLIPSE_PAD, type Ellipse, ellipseCubics, ellipsePoint, ellipseTangent, nearestOnEllipse } from "./ellipse.ts"

// The bond of a variable attachment sweeping round a fused system (an arc): it meets the
// ellipse round the candidates where a line from its atom touches it, follows the ellipse
// three quarters of the way round and curls a little inwards at its open end.

/** How much of the ellipse an arc follows, and over how much of that, at the end, it curls inwards. */
export const ARC_SWEEP = (3 * Math.PI) / 2
const ARC_CURL = Math.PI / 4
/** How far inside the ellipse an arc's open end finishes: within the room left round the atoms. */
const ARC_TUCK = 0.4 * ELLIPSE_PAD

/** Where an arc meets its ellipse: the parameter, the point, and which way round it goes (+1 as the parameter grows). */
export type ArcJoin = { t: number; point: Point; turn: 1 | -1 }

/**
 * Where the bond from `from` meets the ellipse to carry on round it: the point where a line
 * from `from` touches the ellipse, so the straight bond runs smoothly into the curve. Of
 * the two such points, the one the bond's `heading` (the way it comes in) leans towards;
 * from inside the ellipse, the nearest point.
 */
export function arcJoin(e: Ellipse, from: Point, heading?: Point): ArcJoin {
  // In the frame where the ellipse is the unit circle, tangency is kept.
  const cos = Math.cos(e.angle)
  const sin = Math.sin(e.angle)
  const dx = from.x - e.cx
  const dy = from.y - e.cy
  const u = (dx * cos + dy * sin) / e.rx
  const v = (-dx * sin + dy * cos) / e.ry
  const r = Math.hypot(u, v)
  const lean = (t: number, turn: 1 | -1) => {
    const d = ellipseTangent(e, t)
    return heading ? turn * (heading.x * d.x + heading.y * d.y) : turn
  }
  if (r <= 1.0001) {
    const t = nearestOnEllipse(e, from)
    const turn = lean(t, 1) >= lean(t, -1) ? 1 : -1
    return { t, point: ellipsePoint(e, t), turn }
  }
  const towards = Math.atan2(v, u)
  const spread = Math.acos(1 / r)
  // Touching at towards + spread, the line from `from` runs on round the way t grows; at towards - spread, the way it falls.
  const options: ArcJoin[] = [
    { t: towards + spread, point: ellipsePoint(e, towards + spread), turn: 1 },
    { t: towards - spread, point: ellipsePoint(e, towards - spread), turn: -1 },
  ]
  const score = (join: ArcJoin) => {
    const line = { x: join.point.x - from.x, y: join.point.y - from.y }
    const length = Math.hypot(line.x, line.y) || 1
    return heading ? (heading.x * line.x + heading.y * line.y) / length / (Math.hypot(heading.x, heading.y) || 1) : join.turn
  }
  return score(options[0]) > score(options[1]) + 1e-6 ? options[0] : options[1]
}

/** Where an arc's open end finishes: tucked in from the ellipse towards its centre. */
export function arcEnd(e: Ellipse, join: ArcJoin): Point {
  const rim = ellipsePoint(e, join.t + join.turn * ARC_SWEEP)
  const inward = Math.hypot(e.cx - rim.x, e.cy - rim.y) || 1
  return { x: rim.x + ((e.cx - rim.x) / inward) * ARC_TUCK, y: rim.y + ((e.cy - rim.y) / inward) * ARC_TUCK }
}

/** The curve of an arc from where it meets the ellipse (`join`, from arcJoin) to its curled-in end. */
export function arcCubics(e: Ellipse, join: ArcJoin): Cubic[] {
  const curlFrom = join.t + join.turn * (ARC_SWEEP - ARC_CURL)
  const endAt = join.t + join.turn * ARC_SWEEP
  const p0 = ellipsePoint(e, curlFrom)
  const rim = ellipsePoint(e, endAt)
  const inward = Math.hypot(e.cx - rim.x, e.cy - rim.y) || 1
  const end = arcEnd(e, join)
  // The curl: a quarter-ish of the ellipse whose far end is drawn in towards the centre, its direction kept.
  const k = (4 / 3) * Math.tan(ARC_CURL / 4) * join.turn
  const d0 = ellipseTangent(e, curlFrom)
  const d1 = ellipseTangent(e, endAt)
  const shrink = 1 - ARC_TUCK / inward
  const c1 = { x: p0.x + k * d0.x, y: p0.y + k * d0.y }
  const c2 = { x: end.x - k * d1.x * shrink, y: end.y - k * d1.y * shrink }
  return [...ellipseCubics(e, join.t, curlFrom), { from: p0, c1, c2, to: end }]
}

/** Where a loop's line from `from` meets the ellipse: its nearest point. */
export function loopJoin(e: Ellipse, from: Point): Point {
  return ellipsePoint(e, nearestOnEllipse(e, from))
}
