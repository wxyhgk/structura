import { plainFormula } from "../formula.ts"
import { knownLabel } from "../label/known.ts"
import { atomById, componentOf, neighbors, subMolecule } from "../molecule/graph.ts"
import type { Molecule } from "../types.ts"
import { errorsOf, validate } from "../validate.ts"
import { isVariableName } from "./names.ts"

// Drawn pieces as a variable's alternatives: the label "*" marks where a piece joins the
// formula. What makes a piece valid; placing one is placement.ts.

/** The label that marks a piece's point of attachment. */
export const STAR = "*"

/** Most atoms a piece may have; a patent's groups are far smaller. */
const MOST_ATOMS = 300

/** A piece's "*" atoms in id order, each with the atom bonded to it: the one that takes that bond. */
export function fragmentEnds(piece: Molecule): Array<{ star: number; head: number }> {
  return piece.atoms
    .filter((atom) => atom.alias === STAR)
    .sort((a, b) => a.id - b.id)
    .map((star) => ({ star: star.id, head: neighbors(piece, star.id)[0]?.id ?? -1 }))
}

/** Why a drawn piece cannot be an alternative, as a code each caller words in its own language. */
export type FragmentProblem =
  | { code: "no-star" }
  | { code: "too-many-stars"; count: number }
  | { code: "disconnected" }
  | { code: "too-many-atoms"; count: number }
  | { code: "invalid"; message: string }
  | { code: "star-neighbours" }
  | { code: "star-order" }
  | { code: "unknown-label"; label: string }

/** Why a drawn piece cannot be an alternative, or null. */
export function fragmentProblem(piece: Molecule): FragmentProblem | null {
  const ends = fragmentEnds(piece)
  if (ends.length === 0) return { code: "no-star" }
  if (ends.length > 2) return { code: "too-many-stars", count: ends.length }
  if (componentOf(piece, ends[0].star).length !== piece.atoms.length) return { code: "disconnected" }
  if (piece.atoms.length > MOST_ATOMS) return { code: "too-many-atoms", count: piece.atoms.length }
  const broken = errorsOf(validate(piece))
  if (broken.length > 0) return { code: "invalid", message: broken[0].message }
  for (const { star } of ends) {
    const around = neighbors(piece, star)
    if (around.length !== 1 || around[0].alias === STAR) return { code: "star-neighbours" }
    if (piece.bonds.some((bond) => (bond.a === star || bond.b === star) && bond.order !== 1)) return { code: "star-order" }
  }
  const odd = piece.atoms.find((atom) => atom.alias && atom.alias !== STAR && !knownLabel(atom.alias) && !isVariableName(atom.alias))
  if (odd) return { code: "unknown-label", label: odd.alias! }
  return null
}

/** A fragment problem in English words. */
export function fragmentMessage(problem: FragmentProblem): string {
  switch (problem.code) {
    case "no-star":
      return 'mark where the piece joins the formula with an atom labelled "*"'
    case "too-many-stars":
      return `a piece joins the formula at one or two "*" atoms, not ${problem.count}`
    case "disconnected":
      return "the piece is in one piece: every atom joined to the rest"
    case "too-many-atoms":
      return `a piece has at most ${MOST_ATOMS} atoms, not ${problem.count}`
    case "invalid":
      return `the piece is not a valid molecule: ${problem.message}`
    case "star-neighbours":
      return 'each "*" is bonded to exactly one atom of the piece'
    case "star-order":
      return 'a "*" is joined by a single bond'
    case "unknown-label":
      return `"${problem.label}" in the piece is no element, abbreviation or variable`
  }
}

/** Why a drawn piece cannot be an alternative, in English, or null. */
export function fragmentProblemText(piece: Molecule): string | null {
  const problem = fragmentProblem(piece)
  return problem && fragmentMessage(problem)
}

/**
 * "C12H8N": the piece's formula, for showing it by name. Labelled atoms (the "*" marks and
 * inner placeholders) are not counted, but their bonds are, so no hydrogen fills their place.
 */
export function fragmentFormula(piece: Molecule): string {
  return plainFormula(piece)
}

/**
 * The selected atoms as a piece of their own, ready to be an alternative: ids from 1 and
 * centred on the origin. Bonds leaving the selection are dropped; groups wholly inside kept.
 */
export function fragmentFrom(mol: Molecule, atoms: number[]): Molecule {
  const picked = subMolecule(mol, atoms)
  const ids = new Map(picked.atoms.map((atom, index) => [atom.id, index + 1]))
  const xs = picked.atoms.map((atom) => atom.x)
  const ys = picked.atoms.map((atom) => atom.y)
  const [cx, cy] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
  return {
    atoms: picked.atoms.map((atom) => ({ ...atom, id: ids.get(atom.id)!, x: atom.x - cx, y: atom.y - cy })),
    bonds: picked.bonds.map((bond, index) => ({ ...bond, id: index + 1, a: ids.get(bond.a)!, b: ids.get(bond.b)! })),
    groups: picked.groups.map((group, index) => ({ ...group, id: index + 1, atoms: group.atoms.map((id) => ids.get(id)!) })),
    nextAtomId: picked.atoms.length + 1,
    nextBondId: picked.bonds.length + 1,
    nextGroupId: picked.groups.length + 1,
  }
}

/** Placeholder labels inside a piece (R5 in N–R5), in drawing order. */
export function fragmentVariables(piece: Molecule): string[] {
  return [...new Set(piece.atoms.flatMap((atom) => (atom.alias && atom.alias !== STAR && isVariableName(atom.alias) ? [atom.alias] : [])))]
}

/** Why a piece's other joining atoms (`alsoAt`) will not do, or null. */
export function alsoAtProblem(piece: Molecule, alsoAt: number[]): string | null {
  const ends = fragmentEnds(piece)
  if (new Set(ends.map((end) => end.head)).size > 1) return "a linker piece joins by two atoms; it cannot take other joining atoms"
  const stars = new Set(ends.map((end) => end.star))
  for (const id of alsoAt) {
    if (!Number.isInteger(id) || !atomById(piece, id) || stars.has(id)) return `the piece has no atom #${id} to join by`
    if (ends.some((end) => end.head === id)) return `atom #${id} is already where the piece joins`
  }
  return new Set(alsoAt).size === alsoAt.length ? null : "an atom to join by is listed twice"
}
