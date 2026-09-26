import type { Point } from "../types.ts"

export type LabelBox = { left: number; right: number; top: number; bottom: number }

function exitDistance(cx: number, cy: number, ux: number, uy: number, box: LabelBox): number {
  let distance = Infinity
  if (ux > 1e-6) distance = Math.min(distance, (box.right - cx) / ux)
  else if (ux < -1e-6) distance = Math.min(distance, (box.left - cx) / ux)
  if (uy > 1e-6) distance = Math.min(distance, (box.bottom - cy) / uy)
  else if (uy < -1e-6) distance = Math.min(distance, (box.top - cy) / uy)
  if (!Number.isFinite(distance) || distance < 0) return 0
  return distance
}

export function trimSegment(
  a: Point,
  b: Point,
  boxA: LabelBox | null,
  boxB: LabelBox | null,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  if (length < 1) return null
  const ux = dx / length
  const uy = dy / length
  const start = boxA ? exitDistance(a.x, a.y, ux, uy, boxA) : 0
  const end = boxB ? exitDistance(b.x, b.y, -ux, -uy, boxB) : 0
  if (start + end >= length - 1) {
    // Labels this close would swallow the bond; keep a short stub so it is still seen.
    const half = Math.min(length * 0.25, 3)
    const midX = (a.x + b.x) / 2
    const midY = (a.y + b.y) / 2
    return { x1: midX - ux * half, y1: midY - uy * half, x2: midX + ux * half, y2: midY + uy * half }
  }
  return {
    x1: a.x + ux * start,
    y1: a.y + uy * start,
    x2: b.x - ux * end,
    y2: b.y - uy * end,
  }
}
