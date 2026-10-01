import type { Point } from "./types.ts"

/** Wrap to [0, 2π). */
export function norm(angle: number): number {
  const turn = Math.PI * 2
  let value = angle % turn
  if (value < 0) value += turn
  return value
}

/** Signed shortest turn from `from` to `to`, in (-π, π]. */
export function signedDelta(from: number, to: number): number {
  let delta = norm(to) - norm(from)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta <= -Math.PI) delta += Math.PI * 2
  return delta
}

/**
 * Direction from `a` to `b`.
 * 0 points right, positive angles turn counterclockwise on screen
 * (screen y grows downward, so the sine term is flipped).
 */
export function angleTo(a: Point, b: Point): number {
  return Math.atan2(-(b.y - a.y), b.x - a.x)
}

export function pointFrom(origin: Point, angle: number, length: number): Point {
  return {
    x: origin.x + length * Math.cos(angle),
    y: origin.y - length * Math.sin(angle),
  }
}

export function snapAngle(angle: number, step = Math.PI / 12): number {
  return Math.round(angle / step) * step
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return dist(p, a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq))
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy })
}

export function pointInPolygon(p: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    const crosses = (a.y > p.y) !== (b.y > p.y)
    if (!crosses) continue
    const xCross = ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    if (p.x < xCross) inside = !inside
  }
  return inside
}

/** +1 is the visual left of the directed segment a → b. */
export function sideOfLine(a: Point, b: Point, p: Point): 1 | -1 {
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
  return cross <= 0 ? 1 : -1
}
