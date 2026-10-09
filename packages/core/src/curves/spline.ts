import type { Point } from "../types.ts"
import type { Cubic } from "./cubic.ts"

// A smooth curve through given points: a centripetal Catmull-Rom spline, which passes
// through every point without cusps or loops between them and does not overshoot much,
// as cubic Bézier pieces, one from each point to the next.

const near = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6

/** The knot spacing: the square root of the distance (centripetal), never zero. */
const knot = (a: Point, b: Point) => Math.max(Math.sqrt(Math.hypot(b.x - a.x, b.y - a.y)), 1e-4)

/** The piece from p1 to p2, its ends' directions set by the points either side (p0, p3). */
function piece(p0: Point, p1: Point, p2: Point, p3: Point): Cubic {
  const t01 = knot(p0, p1)
  const t12 = knot(p1, p2)
  const t23 = knot(p2, p3)
  // The tangents at p1 and p2, scaled to the piece's own span.
  const m1 = {
    x: t12 * ((p1.x - p0.x) / t01 - (p2.x - p0.x) / (t01 + t12) + (p2.x - p1.x) / t12),
    y: t12 * ((p1.y - p0.y) / t01 - (p2.y - p0.y) / (t01 + t12) + (p2.y - p1.y) / t12),
  }
  const m2 = {
    x: t12 * ((p2.x - p1.x) / t12 - (p3.x - p1.x) / (t12 + t23) + (p3.x - p2.x) / t23),
    y: t12 * ((p2.y - p1.y) / t12 - (p3.y - p1.y) / (t12 + t23) + (p3.y - p2.y) / t23),
  }
  return { from: p1, c1: { x: p1.x + m1.x / 3, y: p1.y + m1.y / 3 }, c2: { x: p2.x - m2.x / 3, y: p2.y - m2.y / 3 }, to: p2 }
}

/**
 * The curve through `points` in order: open, from the first to the last, its ends heading
 * straight at their neighbours; or `closed`, back round to the first. Points repeated one
 * after another count once. Fewer than two points make nothing.
 */
export function catmullRom(points: readonly Point[], closed = false): Cubic[] {
  const kept = points.filter((p, i) => i === 0 || !near(p, points[i - 1]))
  if (closed && kept.length > 2 && near(kept[0], kept[kept.length - 1])) kept.pop()
  const n = kept.length
  if (n < 2) return []
  if (closed) {
    const at = (i: number) => kept[(i + n) % n]
    return kept.map((_, i) => piece(at(i - 1), at(i), at(i + 1), at(i + 2)))
  }
  // Past the ends: each end's neighbour mirrored through it, so the curve leaves it straight.
  const before = { x: 2 * kept[0].x - kept[1].x, y: 2 * kept[0].y - kept[1].y }
  const after = { x: 2 * kept[n - 1].x - kept[n - 2].x, y: 2 * kept[n - 1].y - kept[n - 2].y }
  const at = (i: number) => (i < 0 ? before : i >= n ? after : kept[i])
  return Array.from({ length: n - 1 }, (_, i) => piece(at(i - 1), at(i), at(i + 1), at(i + 2)))
}
