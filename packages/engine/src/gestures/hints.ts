import { canTake, variableLabels } from "@structura/markush"
import { atomById } from "@structura/core/molecule"
import type { Molecule, Point } from "@structura/core/types"

/**
 * Where a line ending inside a ring will attach: the ring positions that can take it (a
 * hydrogen to give up, as generating finds them), their centre, and how far the ring's
 * positions reach from it.
 */
export type RingHintShape = { centre: Point; positions: Point[]; reach: number }

/** The hint for the ring positions `ids` of `mol`, marking those that can take a substituent. */
export function ringHint(mol: Molecule, ids: readonly number[]): RingHintShape {
  const all = ids.flatMap((id) => atomById(mol, id) ?? [])
  const centre = { x: all.reduce((sum, point) => sum + point.x, 0) / all.length, y: all.reduce((sum, point) => sum + point.y, 0) / all.length }
  // Any placeholder hanging off a position makes way, whether or not it is defined yet.
  const names = new Set(variableLabels(mol))
  const positions = all.filter((atom) => canTake(mol, atom.id, names)).map(({ x, y }) => ({ x, y }))
  const reach = Math.max(...all.map((point) => Math.hypot(point.x - centre.x, point.y - centre.y)))
  return { centre, positions, reach }
}
