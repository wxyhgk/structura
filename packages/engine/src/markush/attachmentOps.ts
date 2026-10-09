import type { AttachmentShape } from "@structura/markush"
import type { Op } from "@structura/core/ops"
import type { Molecule, Point } from "@structura/core/types"

/** The first R number the drawing does not use yet: R1, or R2 when R1 is taken, and so on. */
export function nextRName(mol: Molecule): string {
  const used = new Set(mol.atoms.flatMap((atom) => (atom.alias && /^R\d+$/.test(atom.alias) ? [atom.alias] : [])))
  let n = 1
  while (used.has(`R${n}`)) n++
  return `R${n}`
}

/**
 * The ops for a variable attachment from `atom` to any of `to`, drawn as `shape` if given.
 * With `made`, the atom is new: placed there first (it takes the next atom id, which `atom`
 * must be) and labelled with the next free R number, since what hangs off a ring "at any
 * position" is nearly always an R group. One step either way.
 */
export function attachmentOps(mol: Molecule, atom: number, to: number[], options: { made?: Point; shape?: AttachmentShape } = {}): Op[] {
  const attach: Op = { op: "set_attachment", atom, to, ...(options.shape ? { shape: options.shape } : {}) }
  if (!options.made) return [attach]
  return [{ op: "place_atom", el: "C", at: options.made }, { op: "label", atom, text: nextRName(mol) }, attach]
}
