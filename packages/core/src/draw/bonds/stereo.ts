import type { Figure } from "../primitives.ts"
import type { BondContext } from "./context.ts"

const BLACK = "#222222"

export function wedgeBond(context: BondContext): Figure[] {
  const wide = 7
  return [
    {
      kind: "polygon",
      fill: BLACK,
      points: [
        { x: context.x1, y: context.y1 },
        { x: context.x2 + context.normal.x * wide, y: context.y2 + context.normal.y * wide },
        { x: context.x2 - context.normal.x * wide, y: context.y2 - context.normal.y * wide },
      ],
    },
  ]
}

export function dashedBond(context: BondContext): Figure[] {
  return [
    {
      kind: "line",
      x1: context.x1,
      y1: context.y1,
      x2: context.x2,
      y2: context.y2,
      stroke: BLACK,
      width: 1.55,
      dash: "5 4",
    },
  ]
}

export function boldBond(context: BondContext): Figure[] {
  return [
    {
      kind: "line",
      x1: context.x1,
      y1: context.y1,
      x2: context.x2,
      y2: context.y2,
      stroke: BLACK,
      width: 3.4,
      cap: "butt",
    },
  ]
}

export function shadowBond(context: BondContext): Figure[] {
  const ticks = 7
  const half = 3.2
  const figures: Figure[] = []
  for (let index = 0; index < ticks; index++) {
    const t = (index + 0.5) / ticks
    const cx = context.x1 + (context.x2 - context.x1) * t
    const cy = context.y1 + (context.y2 - context.y1) * t
    figures.push({
      kind: "line",
      x1: cx - context.normal.x * half,
      y1: cy - context.normal.y * half,
      x2: cx + context.normal.x * half,
      y2: cy + context.normal.y * half,
      stroke: BLACK,
      width: 1.6,
    })
  }
  return figures
}

export function hashedBond(context: BondContext): Figure[] {
  const ticks = 8
  const figures: Figure[] = []
  for (let index = 1; index <= ticks; index++) {
    const t = index / (ticks + 0.4)
    const cx = context.x1 + (context.x2 - context.x1) * t
    const cy = context.y1 + (context.y2 - context.y1) * t
    const half = 0.7 + t * 3.4
    figures.push({
      kind: "line",
      x1: cx - context.normal.x * half,
      y1: cy - context.normal.y * half,
      x2: cx + context.normal.x * half,
      y2: cy + context.normal.y * half,
      stroke: BLACK,
      width: 1.4,
    })
  }
  return figures
}

export function wavyBond(context: BondContext): Figure[] {
  const waves = 5
  const steps = waves * 8
  const dx = context.x2 - context.x1
  const dy = context.y2 - context.y1
  const points = []
  for (let index = 0; index <= steps; index++) {
    const t = index / steps
    const magnitude = Math.sin(t * waves * Math.PI * 2) * 3
    points.push({
      x: context.x1 + dx * t + context.normal.x * magnitude,
      y: context.y1 + dy * t + context.normal.y * magnitude,
    })
  }
  return [{ kind: "polyline", points, stroke: BLACK, width: 1.35 }]
}
