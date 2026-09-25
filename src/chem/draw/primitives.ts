import type { Point } from "../types.ts"

export type DrawLine = {
  kind: "line"
  x1: number
  y1: number
  x2: number
  y2: number
  stroke: string
  width: number
  cap?: "butt" | "round"
  dash?: string
}

export type DrawPolygon = {
  kind: "polygon"
  points: Point[]
  fill: string
}

export type DrawPolyline = {
  kind: "polyline"
  points: Point[]
  stroke: string
  width: number
}

export type Figure = DrawLine | DrawPolygon | DrawPolyline

export function perpendicular(x1: number, y1: number, x2: number, y2: number): Point {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy) || 1
  return { x: -dy / length, y: dx / length }
}

/** One bond stroke, split at the midpoint so each half can take its atom's color. */
export function coloredStroke(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  offset: number,
  normal: Point,
  trimA: number,
  trimB: number,
  colorA: string,
  colorB: string,
  width: number,
): DrawLine[] {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy) || 1
  const ux = dx / length
  const uy = dy / length
  const sx = x1 + ux * trimA + normal.x * offset
  const sy = y1 + uy * trimA + normal.y * offset
  const ex = x2 - ux * trimB + normal.x * offset
  const ey = y2 - uy * trimB + normal.y * offset
  if (colorA === colorB) {
    return [{ kind: "line", x1: sx, y1: sy, x2: ex, y2: ey, stroke: colorA, width, cap: "butt" }]
  }
  const mx = (sx + ex) / 2
  const my = (sy + ey) / 2
  return [
    { kind: "line", x1: sx, y1: sy, x2: mx, y2: my, stroke: colorA, width, cap: "butt" },
    { kind: "line", x1: mx, y1: my, x2: ex, y2: ey, stroke: colorB, width, cap: "butt" },
  ]
}
