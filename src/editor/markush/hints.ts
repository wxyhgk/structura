import type { Point } from "@/chem/types"

/** Where a line ending inside a ring will attach: the ring's free positions, and their centre. */
export type RingHintShape = { centre: Point; positions: Point[] }

/** The hint for these free positions (the atoms themselves). */
export function ringHint(positions: Point[]): RingHintShape {
  const centre = { x: positions.reduce((sum, point) => sum + point.x, 0) / positions.length, y: positions.reduce((sum, point) => sum + point.y, 0) / positions.length }
  return { centre, positions }
}
