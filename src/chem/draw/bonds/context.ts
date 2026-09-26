import type { BondEmphasis, Point } from "../../types.ts"
import type { LabelBox } from "../clip.ts"

/** Where a double bond's second line goes. `side: 0` centres both lines on the bond, as for C=O. */
export type DoubleFlank = { side: 1 | -1 | 0; trimA: number; trimB: number }

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
