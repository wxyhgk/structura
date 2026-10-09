import { bracketDistance, bracketMarks } from "@structura/core/draw"
import type { Bracket, Molecule, Point } from "@structura/core/types"

/** Clicking a bracket's stroke, in screen pixels. */
const BRACKET_HIT = 6

/** The bracket whose "[" or "]" is under `point` (the nearest, if several), or null. */
export function bracketAt(mol: Molecule, brackets: readonly Bracket[] | undefined, point: Point, zoom: number): Bracket | null {
  let best: { bracket: Bracket; distance: number } | null = null
  for (const mark of bracketMarks(mol, brackets)) {
    const distance = bracketDistance(mark, point)
    if (distance > BRACKET_HIT / zoom || (best && best.distance <= distance)) continue
    best = { bracket: brackets!.find((item) => item.id === mark.id)!, distance }
  }
  return best?.bracket ?? null
}
