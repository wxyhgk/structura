import { BOND_LENGTH } from "../constants.ts"
import type { Molecule, Point } from "../types.ts"
import { emptyMolecule, spliceIn, subMolecule } from "./graph.ts"
import { bondLengthAt } from "./measure.ts"

/** Offsets that put each molecule left to right, two bond lengths apart, centred on y = 0. */
function rowOffsets(molecules: Molecule[]): Array<{ dx: number; dy: number } | null> {
  let cursor = 0
  return molecules.map((mol) => {
    if (mol.atoms.length === 0) return null
    const xs = mol.atoms.map((atom) => atom.x)
    const ys = mol.atoms.map((atom) => atom.y)
    const offset = { dx: cursor - Math.min(...xs), dy: -(Math.min(...ys) + Math.max(...ys)) / 2 }
    cursor += Math.max(...xs) - Math.min(...xs) + BOND_LENGTH * 2
    return offset
  })
}

/**
 * Lays several molecules out left to right, two bond lengths apart and centred on one
 * line, and merges them into one molecule. Ids start after `after`'s counters, so ids
 * already handed out in this session are not handed out again.
 */
export function sideBySide(molecules: Molecule[], after: Molecule = emptyMolecule()): Molecule {
  let merged: Molecule = { ...emptyMolecule(), nextAtomId: after.nextAtomId, nextBondId: after.nextBondId, nextGroupId: after.nextGroupId }
  rowOffsets(molecules).forEach((offset, index) => {
    if (offset) merged = spliceIn(merged, molecules[index], offset.dx, offset.dy).mol
  })
  return merged
}

/**
 * Adds molecules to the right of what is already drawn, two bond lengths away and
 * centred on it, without moving the existing atoms.
 */
export function placeBeside(existing: Molecule, molecules: Molecule[]): Molecule {
  if (existing.atoms.length === 0) return sideBySide(molecules, existing)
  const spot = spotBeside(existing)
  let merged = existing
  rowOffsets(molecules).forEach((offset, index) => {
    if (offset) merged = spliceIn(merged, molecules[index], offset.dx + spot.x, offset.dy + spot.y).mol
  })
  return merged
}

/** Where something new goes: two bond lengths right of the drawing, level with its middle; the origin on an empty page. */
export function spotBeside(existing: Molecule): Point {
  if (existing.atoms.length === 0) return { x: 0, y: 0 }
  const ys = existing.atoms.map((atom) => atom.y)
  return { x: Math.max(...existing.atoms.map((atom) => atom.x)) + BOND_LENGTH * 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
}

/**
 * Copies the given atoms (and the bonds and groups among them) to the right of where
 * they are, two bond lengths clear, with fresh ids. Returns the copy's atom ids.
 */
export function duplicateAtoms(mol: Molecule, atomIds: number[]): { mol: Molecule; ids: number[] } {
  const piece = subMolecule(mol, atomIds)
  if (piece.atoms.length === 0) return { mol, ids: [] }
  const xs = piece.atoms.map((atom) => atom.x)
  const dx = Math.max(...xs) - Math.min(...xs) + bondLengthAt(mol, piece.atoms[0].id) * 2
  return spliceIn(mol, piece, dx, 0)
}
