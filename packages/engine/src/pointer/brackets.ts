import { bracketDistance, structureMarks } from "@structura/core/draw"
import type { Attachment } from "@structura/markush"
import type { Bracket, Molecule, Point } from "@structura/core/types"

/** Clicking a bracket's stroke, in screen pixels. */
const BRACKET_HIT = 6

/**
 * The bracket whose "[" or "]" is under `point` (the nearest, if several), or null. The
 * drawing's `attachments` count: a bracket widens for the ellipse round its atoms.
 */
export function bracketAt(mol: Molecule, brackets: readonly Bracket[] | undefined, point: Point, zoom: number, attachments?: readonly Attachment[]): Bracket | null {
  if (!brackets || brackets.length === 0) return null
  let best: { bracket: Bracket; distance: number } | null = null
  for (const mark of structureMarks(mol, attachments, brackets).brackets) {
    const distance = bracketDistance(mark, point)
    if (distance > BRACKET_HIT / zoom || (best && best.distance <= distance)) continue
    best = { bracket: brackets.find((item) => item.id === mark.id)!, distance }
  }
  return best?.bracket ?? null
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
