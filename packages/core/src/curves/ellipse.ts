import { BOND_LENGTH } from "../constants.ts"
import type { Point } from "../types.ts"
import type { Cubic } from "./cubic.ts"

// The ellipse fitted round a variable attachment's candidate atoms: what a loop is drawn
// as, what an arc follows, and the frame a custom curve's nodes are kept in.

/** An ellipse: centre, semi-axes (`rx` the longer, along `angle`), in drawing coordinates. */
export type Ellipse = { cx: number; cy: number; rx: number; ry: number; angle: number }

/** Room between the candidate atoms and the ellipse round them. */
export const ELLIPSE_PAD = 0.45 * BOND_LENGTH
/** The shortest the minor semi-axis gets, so a row of atoms still gets a round outline. */
const MIN_MINOR = 0.6 * BOND_LENGTH
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
export function ellipseTangent(e: Ellipse, t: number): Point {
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

/** Cubic pieces following the ellipse from parameter `from` to `to`, a quarter turn at most each. */
export function ellipseCubics(e: Ellipse, from: number, to: number): Cubic[] {
  const pieces = Math.max(1, Math.ceil(Math.abs(to - from) / (Math.PI / 2) - 1e-9))
  const span = (to - from) / pieces
  const k = (4 / 3) * Math.tan(span / 4)
  return Array.from({ length: pieces }, (_, i) => {
    const t0 = from + i * span
    const t1 = t0 + span
    const p0 = ellipsePoint(e, t0)
    const p3 = ellipsePoint(e, t1)
    const d0 = ellipseTangent(e, t0)
    const d1 = ellipseTangent(e, t1)
    return { from: p0, c1: { x: p0.x + k * d0.x, y: p0.y + k * d0.y }, c2: { x: p3.x - k * d1.x, y: p3.y - k * d1.y }, to: p3 }
  })
}

/** The box round the whole ellipse. */
export function ellipseBounds(e: Ellipse): { left: number; right: number; top: number; bottom: number } {
  const w = Math.hypot(e.rx * Math.cos(e.angle), e.ry * Math.sin(e.angle))
  const h = Math.hypot(e.rx * Math.sin(e.angle), e.ry * Math.cos(e.angle))
  return { left: e.cx - w, right: e.cx + w, top: e.cy - h, bottom: e.cy + h }
}
