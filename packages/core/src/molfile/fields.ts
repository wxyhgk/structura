import { elementOf } from "../elements/index.ts"
import { bondOrderSum } from "../molecule/graph.ts"
import type { Molecule } from "../types.ts"
import { rGroupNumber } from "./codes.ts"

// What both molfile writers put in an atom's symbol and valence fields.

/**
 * The atom block symbol. A labelled placeholder is R# for an R-group and * (any atom)
 * otherwise, never the carbon it sits on, so other programs do not read it as carbon.
 */
export function symbolOf(atom: Molecule["atoms"][number]): string {
  if (!atom.alias) return atom.el
  return rGroupNumber(atom.alias) != null ? "R#" : "*"
}

/**
 * The atom block's valence field. Elements we give no implicit hydrogens to (metals, Sn…)
 * state their valence outright, 15 meaning zero, so readers do not add hydrogens we never
 * drew. Everything else is left to the reader's own rules (0).
 */
export function valenceField(mol: Molecule, atom: Molecule["atoms"][number]): number {
  if (atom.alias || elementOf(atom.el)?.valences || atom.el === "H") return 0
  const bonds = bondOrderSum(mol, atom.id)
  return bonds === 0 ? 15 : Math.min(bonds, 14)
}
