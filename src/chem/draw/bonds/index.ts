import type { BondStyle, Point } from "../../types.ts"
import { trimSegment, type LabelBox } from "../clip.ts"
import { perpendicular, type Figure } from "../primitives.ts"
import type { BondContext, DoubleFlank } from "./context.ts"
import { doubleBond, singleBond, tripleBond } from "./plain.ts"
import { boldBond, dashedBond, hashedBond, shadowBond, wavyBond, wedgeBond } from "./stereo.ts"

export type { DoubleFlank } from "./context.ts"
export { chainDoubleFlank } from "./plain.ts"

const renderers = {
  single: singleBond,
  double: doubleBond,
  triple: tripleBond,
  wedge: wedgeBond,
  hashed: hashedBond,
  wavy: wavyBond,
  dashed: dashedBond,
  bold: boldBond,
  shadow: shadowBond,
} as const

export type BondKind = keyof typeof renderers

export function bondKind(style: BondStyle): BondKind {
  if (style.order === 1 && style.stereo === "up") return "wedge"
  if (style.order === 1 && style.stereo === "down") return "hashed"
  if (style.order === 1 && style.stereo === "either") return "wavy"
  if (style.order === 1 && style.stereo === "dashed") return "dashed"
  if (style.order === 1 && style.stereo === "bold") return "bold"
  if (style.order === 1 && style.stereo === "shadow") return "shadow"
  if (style.order === 3) return "triple"
  if (style.order === 2) return "double"
  return "single"
}

export function bondFigures(
  a: Point,
  b: Point,
  style: BondStyle,
  colorA: string,
  colorB: string,
  toward: Point | null,
  boxA: LabelBox | null,
  boxB: LabelBox | null,
  flank: DoubleFlank | null = null,
): Figure[] {
  const trimmed = trimSegment(a, b, boxA, boxB)
  if (!trimmed) return []
  const { x1, y1, x2, y2 } = trimmed
  const length = Math.hypot(x2 - x1, y2 - y1)
  if (length < 0.5) return []
  const context: BondContext = {
    x1,
    y1,
    x2,
    y2,
    length,
    normal: perpendicular(x1, y1, x2, y2),
    atomMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    colorA,
    colorB,
    toward,
    flank,
    boxA,
    boxB,
    emphasis: style.emphasis,
  }
  return renderers[bondKind(style)](context)
}
