import { atomHydrogens } from "@structura/core/formula"
import { deleteSelection, neighbors } from "@structura/core/molecule"
import type { Drawing, Molecule } from "@structura/core/types"

// Which candidates of a variable attachment can really take its piece. Enumeration asks
// here as it lays each attachment out, and the panel counts with it, so the two agree.

/** The placeholders that make way for a piece attached at `target`: atoms labelled with one of `names` (R10) that hang off it alone. */
export function displacedAt(mol: Molecule, target: number, names: ReadonlySet<string>): number[] {
  return neighbors(mol, target).flatMap((atom) => (atom.alias && names.has(atom.alias) && neighbors(mol, atom.id).length === 1 ? [atom.id] : []))
}

/** Whether `target` has a hydrogen to give up for a bond: a placeholder, a fusion carbon or a substituted atom has none. */
export function hasRoom(mol: Molecule, target: number): boolean {
  return atomHydrogens(mol, target).h >= 1
}

/** Whether `target` can take an attached piece: once the placeholders on it make way (displacedAt), it has room. */
export function canTake(mol: Molecule, target: number, names: ReadonlySet<string>): boolean {
  const displaced = displacedAt(mol, target, names)
  return hasRoom(displaced.length > 0 ? deleteSelection(mol, { atoms: displaced, bonds: [] }) : mol, target)
}

/**
 * Of the positions `to`, those an attached piece can take (canTake, the formula's variables
 * making way): the ones enumeration does not find occupied.
 */
export function openPositions(drawing: Drawing, to: readonly number[]): number[] {
  const names = new Set(Object.keys(drawing.variables ?? {}))
  return to.filter((id) => canTake(drawing.molecule, id, names))
}
