import { fitEllipse } from "../curves/ellipse.ts"
import { atomById } from "../molecule/graph.ts"
import type { Molecule, Point } from "../types.ts"
import type { Attachment } from "./types.ts"

// The frame a custom attachment curve's nodes are kept in: the ellipse round its candidate
// atoms. A node is [u, v], the point c + u·a·e1 + v·b·e2, so the curve moves, turns, mirrors
// and grows with the rings instead of staying where it was drawn.

/** The ellipse's centre, its axes' directions (unit, at right angles) and its semi-axes along them. */
export type CurveFrame = { centre: Point; e1: Point; e2: Point; a: number; b: number }

/** Below this ratio of its axes the ellipse counts as round, and its own axes say nothing about how the rings lie. */
const ROUND = 1.1

/**
 * The frame round the atoms `to`, in their order. The ellipse's axes are only known up to
 * which way they point (and not at all when it is round), so the candidates themselves
 * settle it: e1 leans towards their weighted sum (later ones weigh more), along it when
 * the ellipse is round; e2 is a quarter turn from e1, the way round the candidates go in
 * order, so a mirrored drawing gets a mirrored frame. All of it turns with the atoms.
 */
export function curveFrame(mol: Molecule, to: readonly number[]): CurveFrame | null {
  const atoms = to.flatMap((id) => atomById(mol, id) ?? [])
  if (atoms.length === 0) return null
  const e = fitEllipse(atoms)
  const centre = { x: e.cx, y: e.cy }
  const lean = atoms.reduce((sum, p, i) => ({ x: sum.x + (i + 1) * (p.x - centre.x), y: sum.y + (i + 1) * (p.y - centre.y) }), { x: 0, y: 0 })
  const leanLength = Math.hypot(lean.x, lean.y)
  let e1 = e.rx / e.ry < ROUND && leanLength > 1e-6 ? { x: lean.x / leanLength, y: lean.y / leanLength } : { x: Math.cos(e.angle), y: Math.sin(e.angle) }
  if (e1.x * lean.x + e1.y * lean.y < 0) e1 = { x: -e1.x, y: -e1.y }
  let area = 0
  atoms.forEach((p, i) => {
    const q = atoms[(i + 1) % atoms.length]
    area += (p.x - centre.x) * (q.y - centre.y) - (p.y - centre.y) * (q.x - centre.x)
  })
  const turn = area < 0 ? -1 : 1
  return { centre, e1, e2: { x: -e1.y * turn, y: e1.x * turn }, a: e.rx, b: e.ry }
}

/** A point of the drawing as [u, v] in the frame, rounded so saved files stay tidy. */
export function intoFrame(frame: CurveFrame, p: Point): [number, number] {
  const dx = p.x - frame.centre.x
  const dy = p.y - frame.centre.y
  const round = (value: number) => Math.round(value * 1e4) / 1e4
  return [round((dx * frame.e1.x + dy * frame.e1.y) / frame.a), round((dx * frame.e2.x + dy * frame.e2.y) / frame.b)]
}

/** The point of the drawing a node [u, v] stands for. */
export function outOfFrame(frame: CurveFrame, [u, v]: readonly [number, number]): Point {
  return {
    x: frame.centre.x + u * frame.a * frame.e1.x + v * frame.b * frame.e2.x,
    y: frame.centre.y + u * frame.a * frame.e1.y + v * frame.b * frame.e2.y,
  }
}

/** Where an attachment's curve nodes are on the drawing now, or null when it has no curve. */
export function curveNodes(mol: Molecule, attachment: Attachment): Point[] | null {
  if (!attachment.curve) return null
  const frame = curveFrame(mol, attachment.to)
  return frame ? attachment.curve.nodes.map((node) => outOfFrame(frame, node)) : null
}
