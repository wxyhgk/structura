import { withGroupMembers } from "./collapse.ts"
import type { Molecule, Selection } from "../types.ts"
import { bondById } from "./graph.ts"

// A selection is a plain set of atom and bond ids, shared by the editor and ops.

/** The selected atoms plus both ends of every selected bond. */
export function atomIdsOfSelection(mol: Molecule, selection: Selection): number[] {
  const ids = new Set(selection.atoms)
  for (const id of selection.bonds) {
    const bond = bondById(mol, id)
    if (!bond) continue
    ids.add(bond.a)
    ids.add(bond.b)
  }
  // A collapsed label stands for its whole group.
  return withGroupMembers(mol, ids)
}

export function selectAll(mol: Molecule): Selection {
  return {
    atoms: mol.atoms.map((atom) => atom.id),
    bonds: mol.bonds.map((bond) => bond.id),
  }
}

export function emptySelection(): Selection {
  return { atoms: [], bonds: [] }
}

export function selectionFromAtoms(mol: Molecule, atomIds: number[]): Selection {
  const set = new Set(atomIds)
  return {
    atoms: atomIds,
    bonds: mol.bonds.filter((bond) => set.has(bond.a) && set.has(bond.b)).map((bond) => bond.id),
  }
}

/** The bonds with one end among `ids` and the other outside: where a fragment joins the rest. */
export function bondsLeaving(mol: Molecule, ids: Iterable<number>): Molecule["bonds"] {
  const inside = new Set(ids)
  return mol.bonds.filter((bond) => inside.has(bond.a) !== inside.has(bond.b))
}
