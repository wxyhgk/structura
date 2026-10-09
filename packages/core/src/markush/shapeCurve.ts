import { ARC_SWEEP, arcEnd, arcJoin } from "../curves/arc.ts"
import { ellipsePoint, fitEllipse, nearestOnEllipse } from "../curves/ellipse.ts"
import { atomById } from "../molecule/graph.ts"
import type { Bracket, Molecule, Point } from "../types.ts"
import { attachmentShape, bondHeading } from "./drawnShape.ts"
import type { Attachment } from "./types.ts"

/** How many nodes a loop's curve starts with, evenly round it. */
const LOOP_NODES = 8
/** How many nodes an arc's curve starts with on the ellipse, before its tucked-in end. */
const ARC_NODES = 5

/**
 * Nodes for a custom curve that looks like the attachment does now, to start editing from:
 * a loop's ellipse as eight nodes round it (closed), starting nearest the atom; an arc as
 * five nodes along its sweep and its curled-in end; a straight line (or a bond into a
 * bracket) as three nodes along the way to the candidates' middle. In drawing coordinates.
 */
export function shapeCurve(mol: Molecule, attachment: Attachment, brackets?: readonly Bracket[]): { nodes: Point[]; closed: boolean } | null {
  const from = atomById(mol, attachment.atom)
  const targets = attachment.to.flatMap((id) => atomById(mol, id) ?? [])
  if (!from || targets.length === 0) return null
  const { shape: _custom, ...chosen } = attachment
  const shape = attachmentShape(mol, attachment.shape === "custom" ? chosen : attachment, brackets)
  if (shape === "line" || shape === "bracket" || shape === "custom") {
    const middle = { x: targets.reduce((sum, p) => sum + p.x, 0) / targets.length, y: targets.reduce((sum, p) => sum + p.y, 0) / targets.length }
    const along = (k: number) => ({ x: from.x + (middle.x - from.x) * k, y: from.y + (middle.y - from.y) * k })
    return { nodes: [along(1 / 3), along(2 / 3), middle], closed: false }
  }
  const e = fitEllipse(targets)
  if (shape === "loop") {
    const t0 = nearestOnEllipse(e, from)
    return { nodes: Array.from({ length: LOOP_NODES }, (_, k) => ellipsePoint(e, t0 + (k * 2 * Math.PI) / LOOP_NODES)), closed: true }
  }
  const join = arcJoin(e, from, bondHeading(mol, from.id))
  // Spread over the sweep, short of the curl, which the end node makes.
  const step = (0.8 * ARC_SWEEP) / (ARC_NODES - 1)
  const along = Array.from({ length: ARC_NODES }, (_, k) => ellipsePoint(e, join.t + join.turn * k * step))
  return { nodes: [...along, arcEnd(e, join)], closed: false }
}
