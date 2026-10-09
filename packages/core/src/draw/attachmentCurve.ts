import { BOND_LENGTH } from "../constants.ts"
import type { Point } from "../types.ts"

// The curves of a variable attachment spread over a fused system: an ellipse fitted round
// the candidate atoms, drawn closed (a loop) or as the bond sweeping round it (an arc).

/** An ellipse: centre, semi-axes (`rx` the longer, along `angle`), in drawing coordinates. */
export type Ellipse = { cx: number; cy: number; rx: number; ry: number; angle: number }

/** Room between the candidate atoms and the ellipse round them. */
export const ELLIPSE_PAD = 0.45 * BOND_LENGTH
/** The shortest the minor semi-axis gets, so a row of atoms still gets a round outline. */
const MIN_MINOR = 0.6 * BOND_LENGTH
/** How much of the ellipse an arc follows, and over how much of that, at the end, it curls inwards. */
const ARC_SWEEP = (3 * Math.PI) / 2
const ARC_CURL = Math.PI / 4
/** How far inside the ellipse an arc's open end finishes: within the room left round the atoms. */
const ARC_TUCK = 0.4 * ELLIPSE_PAD
/** Points on the circle of room kept round each atom, for fitting the ellipse. */
const DISC = 16
/** Samples round an ellipse for nearest points and clearances. */
const SAMPLES = 360

export function ellipsePoint(e: Ellipse, t: number): Point {
  const cos = Math.cos(e.angle)
  const sin = Math.sin(e.angle)
  const u = e.rx * Math.cos(t)
  const v = e.ry * Math.sin(t)
  return { x: e.cx + u * cos - v * sin, y: e.cy + u * sin + v * cos }
}

/** The ellipse's direction at `t`, as t grows (not of unit length). */
function ellipseTangent(e: Ellipse, t: number): Point {
  const cos = Math.cos(e.angle)
  const sin = Math.sin(e.angle)
  const u = -e.rx * Math.sin(t)
  const v = e.ry * Math.cos(t)
  return { x: u * cos - v * sin, y: u * sin + v * cos }
}

/** Where on the ellipse is closest to `p`, as its parameter: sampled, then narrowed down. */
export function nearestOnEllipse(e: Ellipse, p: Point): number {
  const away = (t: number) => {
    const q = ellipsePoint(e, t)
    return (q.x - p.x) ** 2 + (q.y - p.y) ** 2
  }
  const step = (2 * Math.PI) / SAMPLES
  let best = 0
  for (let i = 1; i < SAMPLES; i++) if (away(i * step) < away(best * step)) best = i
  let low = (best - 1) * step
  let high = (best + 1) * step
  for (let i = 0; i < 40; i++) {
    const a = low + (high - low) / 3
    const b = high - (high - low) / 3
    if (away(a) < away(b)) high = b
    else low = a
  }
  return (low + high) / 2
}

/** How far the closest of `points` is from the ellipse's outline. */
export function clearance(e: Ellipse, points: readonly Point[]): number {
  let least = Infinity
  for (let i = 0; i < SAMPLES; i++) {
    const q = ellipsePoint(e, (i * 2 * Math.PI) / SAMPLES)
    for (const p of points) least = Math.min(least, Math.hypot(q.x - p.x, q.y - p.y))
  }
  return least
}

/**
 * The smallest ellipse holding all the points (Khachiyan's method): weights on the points
 * are shifted, one at a time, towards the one farthest outside, until the ellipse settles.
 */
function enclosingEllipse(given: readonly Point[]): Ellipse {
  const n = given.length
  // Worked about the points' middle, so far from the origin the sums keep their precision.
  const mx = given.reduce((sum, p) => sum + p.x, 0) / n
  const my = given.reduce((sum, p) => sum + p.y, 0) / n
  const points = given.map((p) => ({ x: p.x - mx, y: p.y - my }))
  const weight = points.map(() => 1 / n)
  for (let round = 0; round < 1000; round++) {
    // X = Σ w q qᵀ with q = (x, y, 1), and how far out each point lies by it, qᵀ X⁻¹ q.
    let [xx, xy, x1, yy, y1] = [0, 0, 0, 0, 0]
    for (let i = 0; i < n; i++) {
      const { x, y } = points[i]
      const w = weight[i]
      xx += w * x * x
      xy += w * x * y
      x1 += w * x
      yy += w * y * y
      y1 += w * y
    }
    const [a, b, c, , d, e, , , f] = invert3([xx, xy, x1, xy, yy, y1, x1, y1, 1])
    let far = 0
    let farthest = -Infinity
    for (let i = 0; i < n; i++) {
      const { x, y } = points[i]
      const m = a * x * x + 2 * b * x * y + 2 * c * x + d * y * y + 2 * e * y + f
      if (m > farthest) {
        farthest = m
        far = i
      }
    }
    const step = (farthest - 3) / (3 * (farthest - 1))
    if (step < 1e-5) break
    for (let i = 0; i < n; i++) weight[i] *= 1 - step
    weight[far] += step
  }
  const cx = points.reduce((sum, p, i) => sum + weight[i] * p.x, 0)
  const cy = points.reduce((sum, p, i) => sum + weight[i] * p.y, 0)
  // The ellipse is (p - c)ᵀ A (p - c) ≤ 1 with A = ½ (Σ w (p - c)(p - c)ᵀ)⁻¹: its axes are A's eigenvectors.
  let [sxx, sxy, syy] = [0, 0, 0]
  points.forEach((p, i) => {
    sxx += weight[i] * (p.x - cx) ** 2
    sxy += weight[i] * (p.x - cx) * (p.y - cy)
    syy += weight[i] * (p.y - cy) ** 2
  })
  const mean = (sxx + syy) / 2
  const spread = Math.hypot((sxx - syy) / 2, sxy)
  // The covariance's larger eigenvalue lies along the major axis; a semi-axis is √(2 λ).
  const rx = Math.sqrt(2 * (mean + spread))
  const ry = Math.sqrt(2 * Math.max(mean - spread, 0))
  const round = spread < 0.01 * mean
  return { cx: cx + mx, cy: cy + my, rx, ry, angle: round ? 0 : 0.5 * Math.atan2(2 * sxy, sxx - syy) }
}

/** The corners of the convex hull round the points (Andrew's monotone chain). */
function hull(points: readonly Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  if (sorted.length < 3) return sorted
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const half = (list: Point[]) => {
    const chain: Point[] = []
    for (const p of list) {
      while (chain.length >= 2 && cross(chain[chain.length - 2], chain[chain.length - 1], p) <= 0) chain.pop()
      chain.push(p)
    }
    chain.pop()
    return chain
  }
  return [...half(sorted), ...half([...sorted].reverse())]
}

/** The inverse of a 3×3 matrix, row by row. */
function invert3(m: number[]): number[] {
  const [a, b, c, d, e, f, g, h, i] = m
  const A = e * i - f * h
  const B = -(d * i - f * g)
  const C = d * h - e * g
  const det = a * A + b * B + c * C
  return [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map((value) => value / det)
}

/**
 * The ellipse round some atoms with ELLIPSE_PAD of room: the smallest ellipse holding a
 * ring of points round each atom, so it fits a fused system snugly whatever its shape (a
 * row, a bend, a triangle), its long axis along the system. Never thinner than MIN_MINOR.
 */
export function fitEllipse(atoms: readonly Point[], pad = ELLIPSE_PAD): Ellipse {
  const points = atoms.flatMap((p) => Array.from({ length: DISC }, (_, k) => ({ x: p.x + pad * Math.cos((k * 2 * Math.PI) / DISC), y: p.y + pad * Math.sin((k * 2 * Math.PI) / DISC) })))
  // Only the outermost points bound the ellipse.
  let e = enclosingEllipse(hull(points))
  e = { ...e, ry: Math.max(e.ry, MIN_MINOR), rx: Math.max(e.rx, MIN_MINOR) }
  // Between the sampled points the outline can pass a little closer: widen until clear.
  for (let i = 0; i < 12; i++) {
    const gap = clearance(e, atoms)
    if (gap >= pad * 0.97) break
    e = { ...e, rx: e.rx + (pad - gap), ry: e.ry + (pad - gap) }
  }
  return e
}

const f = (value: number) => value.toFixed(2)
const at = (p: Point) => `${f(p.x)} ${f(p.y)}`

/** Cubic Béziers following the ellipse from parameter `from` to `to`, a quarter turn at most each. */
function ellipseCurves(e: Ellipse, from: number, to: number): string {
  const pieces = Math.max(1, Math.ceil(Math.abs(to - from) / (Math.PI / 2) - 1e-9))
  const span = (to - from) / pieces
  const k = (4 / 3) * Math.tan(span / 4)
  let d = ""
  for (let i = 0; i < pieces; i++) {
    const t0 = from + i * span
    const t1 = t0 + span
    const p0 = ellipsePoint(e, t0)
    const p3 = ellipsePoint(e, t1)
    const d0 = ellipseTangent(e, t0)
    const d1 = ellipseTangent(e, t1)
    d += ` C ${at({ x: p0.x + k * d0.x, y: p0.y + k * d0.y })} ${at({ x: p3.x - k * d1.x, y: p3.y - k * d1.y })} ${at(p3)}`
  }
  return d
}

/** The closed ellipse as an SVG path. */
export function ellipsePath(e: Ellipse): string {
  return `M ${at(ellipsePoint(e, 0))}${ellipseCurves(e, 0, 2 * Math.PI)} Z`
}

/** A loop: the straight line from `start` to the nearest point of the ellipse, and the ellipse. */
export function loopPath(start: Point, e: Ellipse): { path: string; end: Point } {
  const end = ellipsePoint(e, nearestOnEllipse(e, start))
  return { path: `M ${at(start)} L ${at(end)} ${ellipsePath(e)}`, end }
}

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

/**
 * An arc: the bond runs straight from `start` to where it touches the ellipse (`join`, from
 * arcJoin), follows it three quarters of the way round, and curls a little inwards at its
 * open end, the way patents draw "joined at any position of these rings".
 */
export function arcPath(start: Point, e: Ellipse, join: ArcJoin): string {
  const curlFrom = join.t + join.turn * (ARC_SWEEP - ARC_CURL)
  const endAt = join.t + join.turn * ARC_SWEEP
  const p0 = ellipsePoint(e, curlFrom)
  const rim = ellipsePoint(e, endAt)
  const inward = Math.hypot(e.cx - rim.x, e.cy - rim.y) || 1
  const end = { x: rim.x + ((e.cx - rim.x) / inward) * ARC_TUCK, y: rim.y + ((e.cy - rim.y) / inward) * ARC_TUCK }
  // The curl: a quarter-ish of the ellipse whose far end is drawn in towards the centre, its direction kept.
  const k = (4 / 3) * Math.tan(ARC_CURL / 4) * join.turn
  const d0 = ellipseTangent(e, curlFrom)
  const d1 = ellipseTangent(e, endAt)
  const shrink = 1 - ARC_TUCK / inward
  const c1 = { x: p0.x + k * d0.x, y: p0.y + k * d0.y }
  const c2 = { x: end.x - k * d1.x * shrink, y: end.y - k * d1.y * shrink }
  const line = Math.hypot(join.point.x - start.x, join.point.y - start.y) > 0.5 ? ` L ${at(join.point)}` : ""
  return `M ${at(start)}${line}${ellipseCurves(e, join.t, curlFrom)} C ${at(c1)} ${at(c2)} ${at(end)}`
}

/** The box round the whole ellipse. */
export function ellipseBounds(e: Ellipse): { left: number; right: number; top: number; bottom: number } {
  const w = Math.hypot(e.rx * Math.cos(e.angle), e.ry * Math.sin(e.angle))
  const h = Math.hypot(e.rx * Math.sin(e.angle), e.ry * Math.cos(e.angle))
  return { left: e.cx - w, right: e.cx + w, top: e.cy - h, bottom: e.cy + h }
}
