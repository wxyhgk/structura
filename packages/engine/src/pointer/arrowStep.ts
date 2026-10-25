import { atomById, neighbors } from "@structura/core/molecule"
import type { Molecule, Point } from "@structura/core/types"

// Moving the hotspot without the mouse: an arrow key steps to the bonded atom that way,
// Shift+arrow runs along the chain. Drawing coordinates, y downward, as on the screen.

const ARROWS: Record<string, Point> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
}

/**
 * How far a bond may turn from the key's direction and still go that way: a zigzag's 60°
 * does, a bond square to the key does not.
 */
const MAX_TURN = (70 * Math.PI) / 180

/** The direction an arrow key points, or null for any other key. */
export function arrowDirection(key: string): Point | null {
  return ARROWS[key] ?? null
}

/** The angle between `direction` and the bond from `from` to `to`. */
function turn(from: Point, to: Point, direction: Point): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) * Math.hypot(direction.x, direction.y)
  if (length === 0) return Math.PI
  return Math.acos(Math.max(-1, Math.min(1, (dx * direction.x + dy * direction.y) / length)))
}

/**
 * The atom bonded to `from` whose bond points most nearly along `direction`, or null when
 * every bond turns away from it by more than MAX_TURN (or `from` has no bonds).
 */
export function neighborToward(mol: Molecule, from: number, direction: Point): number | null {
  const atom = atomById(mol, from)
  if (!atom) return null
  let best: { id: number; angle: number } | null = null
  for (const next of neighbors(mol, from)) {
    const angle = turn(atom, next, direction)
    if (angle <= MAX_TURN && (!best || angle < best.angle)) best = { id: next.id, angle }
  }
  return best?.id ?? null
}

/**
 * Shift+arrow: the first step as neighborToward, then on along the chain while there is
 * just one way on, to the chain's end or the first branch. It never goes back over an atom
 * (round a ring it stops before closing it) nor against the key, so a ring is crossed, not circled.
 */
export function chainEndToward(mol: Molecule, from: number, direction: Point): number | null {
  const first = neighborToward(mol, from, direction)
  if (first == null) return null
  const passed = new Set([from, first])
  let at = first
  for (;;) {
    const onward = neighbors(mol, at).filter((atom) => !passed.has(atom.id))
    // An end, or a branch: the walk stops on it.
    if (onward.length !== 1 || neighbors(mol, at).length !== 2) return at
    const here = atomById(mol, at)!
    if (turn(here, onward[0], direction) >= Math.PI / 2) return at
    at = onward[0].id
    passed.add(at)
  }
}
