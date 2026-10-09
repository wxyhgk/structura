import { atomById, emptyMolecule } from "./molecule/graph.ts"
import type { Drawing } from "./types.ts"

export {
  addBracket,
  bracketProblem,
  bracketRepeatProblem,
  bracketsWithin,
  carryBrackets,
  crossingBonds,
  DEFAULT_REPEAT,
  nextBracketId,
  pruneBrackets,
  withBrackets,
} from "./drawing/brackets.ts"

export function emptyDrawing(): Drawing {
  return { molecule: emptyMolecule(), arrows: [], nextArrowId: 1 }
}

export function addReactionArrow(
  drawing: Drawing,
  ids: number[],
  direction: "left" | "right" | "up" | "down",
): Drawing {
  const mol = drawing.molecule
  if (ids.length === 0) return drawing
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const id of ids) {
    const atom = atomById(mol, id)
    if (!atom) continue
    minX = Math.min(minX, atom.x)
    minY = Math.min(minY, atom.y)
    maxX = Math.max(maxX, atom.x)
    maxY = Math.max(maxY, atom.y)
  }
  if (!Number.isFinite(minX)) return drawing
  const gap = 28
  const length = 70
  const arrows = drawing.arrows
  const along =
    direction === "right" ? maxX : direction === "left" ? minX : direction === "down" ? maxY : minY
  const crowded = arrows.filter((arrow) => {
    const end = direction === "left" || direction === "right" ? Math.max(arrow.x1, arrow.x2) : Math.max(arrow.y1, arrow.y2)
    const start = direction === "left" || direction === "right" ? Math.min(arrow.x1, arrow.x2) : Math.min(arrow.y1, arrow.y2)
    return direction === "right" || direction === "down" ? end >= along : start <= along
  }).length
  const offset = gap + crowded * 24
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2
  let x1 = midX
  let y1 = midY
  let x2 = midX
  let y2 = midY
  if (direction === "right") {
    x1 = maxX + offset
    x2 = x1 + length
    y1 = midY
    y2 = midY
  } else if (direction === "left") {
    x2 = minX - offset
    x1 = x2 - length
    y1 = midY
    y2 = midY
  } else if (direction === "down") {
    y1 = maxY + offset
    y2 = y1 + length
    x1 = midX
    x2 = midX
  } else {
    y2 = minY - offset
    y1 = y2 - length
    x1 = midX
    x2 = midX
  }
  const id = drawing.nextArrowId
  return { ...drawing, arrows: [...arrows, { id, x1, y1, x2, y2 }], nextArrowId: id + 1 }
}
