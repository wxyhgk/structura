import { atomById, landings, moveAtoms, SNAP_ATOM } from "@structura/core/molecule"
import type { Molecule } from "@structura/core/types"

/**
 * Dragging atoms: when one of them comes near an atom that stays, the drag snaps so they
 * sit exactly on each other, and that atom is where they will join on letting go.
 */
export function snappedMove(mol: Molecule, ids: number[], dx: number, dy: number, zoom: number): { dx: number; dy: number; target: number | null } {
  const moved = moveAtoms(mol, ids, dx, dy)
  const [pair] = landings(moved, ids, SNAP_ATOM / zoom)
  if (!pair) return { dx, dy, target: null }
  const [from, onto] = [atomById(moved, pair[0])!, atomById(moved, pair[1])!]
  return { dx: dx + onto.x - from.x, dy: dy + onto.y - from.y, target: pair[1] }
}
