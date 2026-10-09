import { simplifyPath } from "@structura/core/curves"
import { pointInPolygon } from "@structura/core/geometry"
import { ringMembership } from "@structura/core/molecule"
import { CURVE_MAX_NODES, ringAt } from "@structura/markush"
import type { Molecule, Point } from "@structura/core/types"
import type { SweptRing } from "../gestures/types.ts"

// The attachment tool drawing a custom curve: the path the pointer took, from the atom,
// made into a few nodes for a smooth curve, and the rings it went round.

/** How closely the nodes keep to the path drawn, in bond lengths. */
const TOLERANCE = 0.25
/** The most nodes a drawn path becomes. */
const MOST = Math.min(12, CURVE_MAX_NODES)
/** Ending this near (in bond lengths) where its first node is closes the curve into a loop. */
const CLOSE_WITHIN = 0.6

/**
 * The curve for a path drawn from `origin` (the atom): its corners, within a quarter of a
 * bond length of what was drawn and at most twelve, without the atom itself. Ending near
 * the first of them makes it a closed loop (that last node dropped, as it is the first one
 * again). Null for a path too short to be one.
 */
export function freehandCurve(origin: Point, path: readonly Point[], bondLength: number): { nodes: Point[]; closed: boolean } | null {
  const corners = simplifyPath([origin, ...path], TOLERANCE * bondLength, MOST + 1)
  const nodes = corners.slice(1)
  if (nodes.length === 0 || Math.hypot(nodes[nodes.length - 1].x - origin.x, nodes[nodes.length - 1].y - origin.y) < 0.3 * bondLength) return null
  const last = nodes[nodes.length - 1]
  if (nodes.length >= 4 && Math.hypot(last.x - nodes[0].x, last.y - nodes[0].y) < CLOSE_WITHIN * bondLength) return { nodes: nodes.slice(0, -1), closed: true }
  if (nodes.length === 1) return { nodes: [{ x: (origin.x + last.x) / 2, y: (origin.y + last.y) / 2 }, last], closed: false }
  return { nodes, closed: false }
}

/**
 * The rings a drawn path goes round: those whose middle is inside it (closed back to its
 * start), as the attachment tool gathers rings. `from` is the atom it hangs from, never a
 * candidate.
 */
export function ringsInside(mol: Molecule, path: readonly Point[], from: number | undefined): SweptRing[] {
  if (path.length < 3) return []
  const polygon = [...path]
  return ringMembership(mol).rings.flatMap((ring) => {
    const atoms = ring.flatMap((id) => mol.atoms.find((atom) => atom.id === id) ?? [])
    const middle = { x: atoms.reduce((sum, p) => sum + p.x, 0) / atoms.length, y: atoms.reduce((sum, p) => sum + p.y, 0) / atoms.length }
    if (!pointInPolygon(middle, polygon)) return []
    const found = ringAt(mol, middle, from)
    return found ? [found] : []
  })
}
