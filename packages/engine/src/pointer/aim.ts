import type { Attachment } from "@structura/markush"
import type { Bracket, HotTarget, Molecule, Point } from "@structura/core/types"
import { bracketNear } from "./brackets.ts"
import { curveDistance, customMarks } from "./curves.ts"
import { nearestTarget, reachOf, type Aim } from "./targeting.ts"

/** What the pointer aims at: an atom or bond (`hit`), a custom curve, or a bracket's stroke; at most one. */
export type Aimed = { hit: HotTarget | null; curve: boolean; bracket: Bracket | null }

/**
 * What a press takes and the hover marks: the nearest of the atoms and bonds and, where `with`
 * says they can be taken, the custom curves and the brackets, all within the one reach. On a
 * tie the atom or bond wins, then the curve.
 */
export function aimAt(
  drawing: { mol: Molecule; attachments?: readonly Attachment[]; brackets?: readonly Bracket[] },
  point: Point,
  zoom: number,
  aim: Aim & { with?: { curves?: boolean; brackets?: boolean } } = {},
): Aimed {
  const { mol, attachments, brackets } = drawing
  const near = nearestTarget(mol, point, zoom, aim)
  const reach = reachOf(mol, zoom, aim.coarse)
  const marks = aim.with?.curves ? customMarks(mol, attachments, brackets) : []
  const toCurve = marks.length > 0 ? curveDistance(marks, point) : Infinity
  const curve = toCurve <= reach ? toCurve : Infinity
  const bracket = aim.with?.brackets ? bracketNear(mol, brackets, point, reach, attachments) : null
  const toBracket = bracket?.distance ?? Infinity
  if (near && near.distance <= curve && near.distance <= toBracket) return { hit: near.target, curve: false, bracket: null }
  if (curve <= toBracket && curve < Infinity) return { hit: null, curve: true, bracket: null }
  return { hit: null, curve: false, bracket: bracket?.bracket ?? null }
}
