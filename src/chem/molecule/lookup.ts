import type { Atom, Bond, Molecule } from "../types.ts"

/** Constant-time answers to "which atom is this", "what touches it" and "are these bonded". */
type Lookup = {
  atoms: Atom[]
  bonds: Bond[]
  atomCount: number
  bondCount: number
  atomById: Map<number, Atom>
  bondById: Map<number, Bond>
  bondsOf: Map<number, Bond[]>
}

/**
 * Molecules are treated as immutable once handed out, so one lookup per molecule object
 * is enough. Edits still fill in a fresh clone in place before returning it; the array
 * and length check rebuilds the lookup if one was taken halfway through that.
 */
const cache = new WeakMap<Molecule, Lookup>()

function addTo(bondsOf: Map<number, Bond[]>, atomId: number, bond: Bond): void {
  const list = bondsOf.get(atomId)
  if (list) list.push(bond)
  else bondsOf.set(atomId, [bond])
}

function build(mol: Molecule): Lookup {
  const atomById = new Map<number, Atom>()
  for (const atom of mol.atoms) if (!atomById.has(atom.id)) atomById.set(atom.id, atom)
  const bondById = new Map<number, Bond>()
  const bondsOf = new Map<number, Bond[]>()
  for (const bond of mol.bonds) {
    if (!bondById.has(bond.id)) bondById.set(bond.id, bond)
    addTo(bondsOf, bond.a, bond)
    if (bond.b !== bond.a) addTo(bondsOf, bond.b, bond)
  }
  return { atoms: mol.atoms, bonds: mol.bonds, atomCount: mol.atoms.length, bondCount: mol.bonds.length, atomById, bondById, bondsOf }
}

export function lookup(mol: Molecule): Lookup {
  const found = cache.get(mol)
  if (
    found &&
    found.atoms === mol.atoms &&
    found.bonds === mol.bonds &&
    found.atomCount === mol.atoms.length &&
    found.bondCount === mol.bonds.length
  ) {
    return found
  }
  const fresh = build(mol)
  cache.set(mol, fresh)
  return fresh
}

const NONE: readonly Bond[] = []

/** Bonds touching the atom, in the molecule's bond order. */
export function bondsOf(mol: Molecule, atomId: number): readonly Bond[] {
  return lookup(mol).bondsOf.get(atomId) ?? NONE
}
