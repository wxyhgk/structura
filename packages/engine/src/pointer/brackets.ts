import { bracketDistance, structureMarks } from "@structura/core/draw"
import type { Attachment } from "@structura/markush"
import type { Bracket, Molecule, Point } from "@structura/core/types"
import { marksOf } from "./marks.ts"
import { reachOf } from "./targeting.ts"

/**
 * The bracket whose "[" or "]" is under `point` (the nearest, if several, within the pointer's
 * reach), or null. The drawing's `attachments` count: a bracket widens for the ellipse round its atoms.
 */
export function bracketAt(mol: Molecule, brackets: readonly Bracket[] | undefined, point: Point, zoom: number, attachments?: readonly Attachment[]): Bracket | null {
  return bracketNear(mol, brackets, point, reachOf(mol, zoom), attachments)?.bracket ?? null
}

/** The bracket whose strokes are nearest `point`, within `reach` (drawing units), and how near. */
export function bracketNear(mol: Molecule, brackets: readonly Bracket[] | undefined, point: Point, reach: number, attachments?: readonly Attachment[]): { bracket: Bracket; distance: number } | null {
  if (!brackets || brackets.length === 0) return null
  let best: { bracket: Bracket; distance: number } | null = null
  for (const mark of marksOf(mol, attachments, brackets).brackets) {
    const distance = bracketDistance(mark, point)
    if (distance > reach || (best && best.distance <= distance)) continue
    best = { bracket: brackets.find((item) => item.id === mark.id)!, distance }
  }
  return best
}

/**
 * A bond dragged from atom `from` and let go at `point` inside a group bracket (between its
 * uprights, from top to bottom) that does not hold `from`: it goes into that bracket, "joined
 * at any position of the bracketed group". Returns the bracket (the innermost, if they nest)
 * and where the bond into it will end, or null. Whether `point` is on an atom or inside a
 * ring is the caller's to rule out first.
 */
export function bracketDropAt(
  mol: Molecule,
  brackets: readonly Bracket[] | undefined,
  attachments: readonly Attachment[] | undefined,
  point: Point,
  from: number,
): { bracket: Bracket; end: Point } | null {
  if (!brackets?.some((bracket) => bracket.kind === "group")) return null
  let best: { bracket: Bracket; area: number } | null = null
  for (const mark of structureMarks(mol, attachments, brackets).brackets) {
    const bracket = brackets.find((item) => item.id === mark.id)!
    const { left, right, top, bottom } = mark.uprights
    if (bracket.kind !== "group" || bracket.atoms.length < 2 || bracket.atoms.includes(from)) continue
    if (point.x <= left || point.x >= right || point.y <= top || point.y >= bottom) continue
    const area = (right - left) * (bottom - top)
    if (!best || area < best.area) best = { bracket, area }
  }
  if (!best) return null
  // Drawn as it will be once made, so the preview ends where the bond will.
  const others = (attachments ?? []).filter((attachment) => attachment.atom !== from)
  const made = structureMarks(mol, [...others, { atom: from, to: best.bracket.atoms }], brackets).attachments.find((mark) => mark.atom === from)
  return made ? { bracket: best.bracket, end: made.to } : null
}
