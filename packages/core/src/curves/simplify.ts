import { distToSegment } from "../geometry.ts"
import type { Point } from "../types.ts"

// A path drawn by hand made into a few points: the corners that matter (Ramer–Douglas–Peucker).

/** The points of `path` that keep it within `tolerance` of itself, ends always kept. */
function rdp(path: readonly Point[], tolerance: number): Point[] {
  if (path.length <= 2) return [...path]
  const first = path[0]
  const last = path[path.length - 1]
  let far = 0
  let farthest = -1
  for (let i = 1; i < path.length - 1; i++) {
    const away = distToSegment(path[i], first, last)
    if (away > farthest) {
      farthest = away
      far = i
    }
  }
  if (farthest <= tolerance) return [first, last]
  return [...rdp(path.slice(0, far + 1), tolerance).slice(0, -1), ...rdp(path.slice(far), tolerance)]
}

/**
 * `path` as few points, its shape kept within `tolerance`, and at most `cap` points: the
 * tolerance widens until they fit.
 */
export function simplifyPath(path: readonly Point[], tolerance: number, cap = Infinity): Point[] {
  let points = rdp(path, tolerance)
  let widened = tolerance
  while (points.length > Math.max(cap, 2)) {
    widened *= 1.4
    points = rdp(path, widened)
  }
  return points
}
