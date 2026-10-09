import type { Point } from "../types.ts"

// Cubic Bézier pieces, the one form every curve of the drawing takes: the canvas and SVG
// draw them as a path, CDXML writes their control points, hit-testing samples them.

/** One cubic Bézier piece, from `from` to `to`, pulled by `c1` and `c2`. */
export type Cubic = { from: Point; c1: Point; c2: Point; to: Point }

/** A point on the piece at `t` (0 at its start, 1 at its end). */
export function cubicPoint(cubic: Cubic, t: number): Point {
  const s = 1 - t
  const [a, b, c, d] = [s * s * s, 3 * s * s * t, 3 * s * t * t, t * t * t]
  return {
    x: a * cubic.from.x + b * cubic.c1.x + c * cubic.c2.x + d * cubic.to.x,
    y: a * cubic.from.y + b * cubic.c1.y + c * cubic.c2.y + d * cubic.to.y,
  }
}

const f = (value: number) => value.toFixed(2)
const at = (p: Point) => `${f(p.x)} ${f(p.y)}`

/** The pieces as SVG path commands after a start already made: " C c1 c2 to" each. */
export function cubicsCommands(cubics: readonly Cubic[]): string {
  return cubics.map((cubic) => ` C ${at(cubic.c1)} ${at(cubic.c2)} ${at(cubic.to)}`).join("")
}

/** The pieces as one SVG path from the first one's start, closed with Z when `closed`. */
export function cubicsPath(cubics: readonly Cubic[], closed = false): string {
  if (cubics.length === 0) return ""
  return `M ${at(cubics[0].from)}${cubicsCommands(cubics)}${closed ? " Z" : ""}`
}

/** Points along the pieces, `per` to each piece, ends included. */
export function sampleCubics(cubics: readonly Cubic[], per = 16): Point[] {
  if (cubics.length === 0) return []
  return [cubics[0].from, ...cubics.flatMap((cubic) => Array.from({ length: per }, (_, i) => cubicPoint(cubic, (i + 1) / per)))]
}

/** The box round the pieces (sampled, so within a hair of the exact one). */
export function cubicsBounds(cubics: readonly Cubic[]): { left: number; right: number; top: number; bottom: number } {
  const points = sampleCubics(cubics, 24)
  return {
    left: Math.min(...points.map((p) => p.x)),
    right: Math.max(...points.map((p) => p.x)),
    top: Math.min(...points.map((p) => p.y)),
    bottom: Math.max(...points.map((p) => p.y)),
  }
}

/** Where on the pieces is closest to `p`: which piece, where along it, the point, and how far. */
export function nearestOnCubics(cubics: readonly Cubic[], p: Point): { index: number; t: number; point: Point; distance: number } | null {
  let best: { index: number; t: number; point: Point; distance: number } | null = null
  const away = (cubic: Cubic, t: number) => {
    const q = cubicPoint(cubic, t)
    return Math.hypot(q.x - p.x, q.y - p.y)
  }
  cubics.forEach((cubic, index) => {
    const steps = 32
    let low = 0
    for (let i = 1; i <= steps; i++) if (away(cubic, i / steps) < away(cubic, low / steps)) low = i
    // Narrowed down round the best sample.
    let a = Math.max(0, (low - 1) / steps)
    let b = Math.min(1, (low + 1) / steps)
    for (let i = 0; i < 30; i++) {
      const m1 = a + (b - a) / 3
      const m2 = b - (b - a) / 3
      if (away(cubic, m1) < away(cubic, m2)) b = m2
      else a = m1
    }
    const t = (a + b) / 2
    const distance = away(cubic, t)
    if (!best || distance < best.distance) best = { index, t, point: cubicPoint(cubic, t), distance }
  })
  return best
}
