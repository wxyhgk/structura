import type { BondEmphasis, Point } from "../../types.ts"
import type { LabelBox } from "../clip.ts"

export type DoubleFlank = { side: 1 | -1; trimA: number; trimB: number }

/** Everything a bond renderer needs. New bond styles should only read this. */
export type BondContext = {
  x1: number
  y1: number
  x2: number
  y2: number
  length: number
  normal: Point
  atomMid: Point
  colorA: string
  colorB: string
  toward: Point | null
  flank: DoubleFlank | null
  boxA: LabelBox | null
  boxB: LabelBox | null
  emphasis?: BondEmphasis
}
