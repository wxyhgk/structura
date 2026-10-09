import { distToSegment } from "@structura/core/geometry"
import { nearestOnCubics } from "@structura/core/curves"
import { structureMarks, type AttachmentMark } from "@structura/core/draw"
import type { Attachment } from "@structura/markush"
import type { Bracket, Molecule, Point } from "@structura/core/types"

// Finding custom attachment curves under the pointer: their node handles, and the curve
// itself (to pick it, or to put a node in).

/** How near a node's handle the pointer must be, in screen pixels (the handle is drawn 8 px across). */
const NODE_HIT = 7
/** How near the curve's stroke, in screen pixels. */
const PATH_HIT = 6

/** A custom curve as drawn: its mark, with the nodes and pieces editing needs. */
export type CustomMark = AttachmentMark & { custom: NonNullable<AttachmentMark["custom"]> }

/** The attachments drawn as custom curves, worked out only when there are any. */
export function customMarks(mol: Molecule, attachments: readonly Attachment[] | undefined, brackets: readonly Bracket[] | undefined): CustomMark[] {
  if (!attachments?.some((attachment) => attachment.shape === "custom" && attachment.curve)) return []
  return structureMarks(mol, attachments, brackets).attachments.filter((mark): mark is CustomMark => mark.custom != null)
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
 * Where on `mark`'s stroke `point` is, if near enough: the point on it, and where a node put
 * there goes in the list (`insertAt`); null for the straight line a loop is joined by, where
 * no node can go.
 */
export function pathAt(mark: CustomMark, point: Point, zoom: number): { point: Point; insertAt: number | null } | null {
  const { cubics, closed } = mark.custom
  const near = nearestOnCubics(cubics, point)
  if (near && near.distance <= PATH_HIT / zoom) {
    // Open, the pieces run atom → node 0 → node 1…, so piece i ends at node i; closed, piece i runs from node i.
    return { point: near.point, insertAt: closed ? near.index + 1 : near.index }
  }
  if (closed && distToSegment(point, mark.from, mark.to) <= PATH_HIT / zoom) return { point, insertAt: null }
  return null
}

/** The custom curve whose stroke is under `point` (the topmost: the last drawn), or null. */
export function curveAt(marks: readonly CustomMark[], point: Point, zoom: number): CustomMark | null {
  for (let i = marks.length - 1; i >= 0; i--) if (pathAt(marks[i], point, zoom)) return marks[i]
  return null
}
