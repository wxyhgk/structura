import { distToSegment } from "@structura/core/geometry"
import { nearestOnCubics } from "@structura/core/curves"
import type { AttachmentMark } from "@structura/core/draw"
import type { Attachment } from "@structura/markush"
import type { Bracket, Molecule, Point } from "@structura/core/types"
import { marksOf } from "./marks.ts"

// Finding custom attachment curves under the pointer: their node handles, and the curve
// itself (to pick it, or to put a node in).

/** How near a node's handle the pointer must be, in screen pixels: the handle is drawn 8 px across at any zoom. */
const NODE_HIT = 7

/** A custom curve as drawn: its mark, with the nodes and pieces editing needs. */
export type CustomMark = AttachmentMark & { custom: NonNullable<AttachmentMark["custom"]> }

/** The attachments drawn as custom curves, worked out only when there are any. */
export function customMarks(mol: Molecule, attachments: readonly Attachment[] | undefined, brackets: readonly Bracket[] | undefined): CustomMark[] {
  if (!attachments?.some((attachment) => attachment.shape === "custom" && attachment.curve)) return []
  return marksOf(mol, attachments, brackets).attachments.filter((mark): mark is CustomMark => mark.custom != null)
}

/** The node of `mark` whose handle is under `point` (the nearest), or null. */
export function nodeAt(mark: CustomMark, point: Point, zoom: number): number | null {
  let best: number | null = null
  let nearest = NODE_HIT / zoom
  mark.custom.nodes.forEach((node, index) => {
    const distance = Math.max(Math.abs(node.x - point.x), Math.abs(node.y - point.y))
    if (distance <= nearest) {
      best = index
      nearest = distance
    }
  })
  return best
}

/**
 * Where on `mark`'s stroke `point` is, if within `reach` (drawing units): the point on it, and where a node put
 * there goes in the list (`insertAt`); null for the straight line a loop is joined by, where
 * no node can go.
 */
export function pathAt(mark: CustomMark, point: Point, reach: number): { point: Point; insertAt: number | null } | null {
  const { cubics, closed } = mark.custom
  const near = nearestOnCubics(cubics, point)
  if (near && near.distance <= reach) {
    // Open, the pieces run atom → node 0 → node 1…, so piece i ends at node i; closed, piece i runs from node i.
    return { point: near.point, insertAt: closed ? near.index + 1 : near.index }
  }
  if (closed && distToSegment(point, mark.from, mark.to) <= reach) return { point, insertAt: null }
  return null
}

/** How far `point` is from the nearest custom curve's stroke (a loop's joining line too), in world units; Infinity with none. */
export function curveDistance(marks: readonly CustomMark[], point: Point): number {
  let nearest = Infinity
  for (const mark of marks) {
    const near = nearestOnCubics(mark.custom.cubics, point)
    if (near) nearest = Math.min(nearest, near.distance)
    if (mark.custom.closed) nearest = Math.min(nearest, distToSegment(point, mark.from, mark.to))
  }
  return nearest
}

/** The custom curve whose stroke is under `point` (the topmost: the last drawn), or null. */
export function curveAt(marks: readonly CustomMark[], point: Point, reach: number): CustomMark | null {
  for (let i = marks.length - 1; i >= 0; i--) if (pathAt(marks[i], point, reach)) return marks[i]
  return null
}
