import type { Molecule, Point } from "../types.ts"
import { atomById, bondBetween, cloneMolecule, componentOf, neighbors } from "./graph.ts"

// Joining pieces the way ChemDraw does: an atom dropped on another becomes that atom, and two
// pieces can be joined at an atom or a bond each.

/**
 * Folds atom `drop` into `keep`: its bonds move over to `keep`, except one to `keep` itself
 * or to an atom `keep` is already bonded to (that bond stays as it was). `keep` stays as it
 * is; `drop` goes. Groups touching either are dissolved.
 */
export function mergeAtoms(mol: Molecule, keep: number, drop: number): Molecule {
  if (keep === drop || !atomById(mol, keep) || !atomById(mol, drop)) return mol
  const next = cloneMolecule(mol)
  next.bonds = next.bonds.flatMap((bond) => {
    if (bond.a !== drop && bond.b !== drop) return [bond]
    const other = bond.a === drop ? bond.b : bond.a
    if (other === keep || bondBetween(mol, keep, other)) return []
    return [{ ...bond, a: bond.a === drop ? keep : bond.a, b: bond.b === drop ? keep : bond.b }]
  })
  next.atoms = next.atoms.filter((atom) => atom.id !== drop)
  next.groups = next.groups.filter((group) => !group.atoms.includes(keep) && !group.atoms.includes(drop))
  return next
}

/**
 * Where atoms that moved came down on atoms that stayed: [moved, stayed] pairs within
 * `reach`, nearest first, each atom in one pair at most. An atom never lands on one it is
 * bonded to (that would fold a bond to nothing).
 */
export function landings(mol: Molecule, moved: number[], reach: number): Array<[number, number]> {
  const moving = new Set(moved)
  const stayed = mol.atoms.filter((atom) => !moving.has(atom.id))
  const candidates = moved.flatMap((id) => {
    const atom = atomById(mol, id)
    if (!atom) return []
    const bonded = new Set(neighbors(mol, id).map((other) => other.id))
    return stayed
      .filter((other) => !bonded.has(other.id))
      .map((other) => ({ pair: [id, other.id] as [number, number], distance: Math.hypot(atom.x - other.x, atom.y - other.y) }))
      .filter((candidate) => candidate.distance <= reach)
  })
  candidates.sort((a, b) => a.distance - b.distance)
  const used = new Set<number>()
  const pairs: Array<[number, number]> = []
  for (const { pair } of candidates) {
    if (used.has(pair[0]) || used.has(pair[1])) continue
    used.add(pair[0])
    used.add(pair[1])
    pairs.push(pair)
  }
  return pairs
}

/** Merges each [moved, stayed] pair, the atom that stayed keeping its identity. */
export function mergeLandings(mol: Molecule, pairs: Array<[number, number]>): Molecule {
  return pairs.reduce((next, [moved, stayed]) => mergeAtoms(next, stayed, moved), mol)
}

/** Every atom of `ids` turned by `angle` about `pivot` and then shifted by `shift`. */
function place(mol: Molecule, ids: number[], pivot: Point, angle: number, shift: Point): Molecule {
  const moving = new Set(ids)
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)]
  return {
    ...mol,
    atoms: mol.atoms.map((atom) => {
      if (!moving.has(atom.id)) return atom
      const [dx, dy] = [atom.x - pivot.x, atom.y - pivot.y]
      return { ...atom, x: pivot.x + cos * dx - sin * dy + shift.x, y: pivot.y + sin * dx + cos * dy + shift.y }
    }),
  }
}

/**
 * The two pieces: the one that stays and the one that moves, or why they cannot be joined.
 * The larger stays, or `a`'s with `keepFirst` (a template fused onto a drawing moves, never the drawing).
 */
function pieces(mol: Molecule, a: number, b: number, keepFirst = false): { stay: number; move: number; moving: number[] } | { error: string } {
  const sideA = componentOf(mol, a)
  if (sideA.includes(b)) return { error: "they are already in one piece" }
  const sideB = componentOf(mol, b)
  return keepFirst || sideA.length >= sideB.length ? { stay: a, move: b, moving: sideB } : { stay: b, move: a, moving: sideA }
}

/** Joins two pieces at an atom each: the smaller piece moves so its atom lands on the other's, and the two become one. */
export function joinAtoms(mol: Molecule, a: number, b: number): Molecule | { error: string } {
  const split = pieces(mol, a, b)
  if ("error" in split) return split
  const [stay, move] = [atomById(mol, split.stay)!, atomById(mol, split.move)!]
  const moved = place(mol, split.moving, move, 0, { x: stay.x - move.x, y: stay.y - move.y })
  return mergeAtoms(moved, split.stay, split.move)
}

/**
 * Joins two pieces at a bond each, fusing the bonds: the smaller piece turns and moves so
 * its bond lies on the other's, on the far side of it, and both pairs of atoms merge.
 */
export function joinBonds(mol: Molecule, a: { a: number; b: number }, b: { a: number; b: number }): Molecule | { error: string } {
  const fused = fuseBonds(mol, a, b)
  return "error" in fused ? fused : fused.mol
}

/**
 * joinBonds, saying which atom went into which ([moved, stayed] pairs). With `keepFirst`,
 * `a`'s piece stays put whatever the sizes.
 */
export function fuseBonds(
  mol: Molecule,
  a: { a: number; b: number },
  b: { a: number; b: number },
  keepFirst = false,
): { mol: Molecule; pairs: Array<[number, number]> } | { error: string } {
  const split = pieces(mol, a.a, b.a, keepFirst)
  if ("error" in split) return split
  const [stayBond, moveBond] = split.stay === a.a ? [a, b] : [b, a]
  const at = (id: number) => atomById(mol, id)!
  const stayPiece = componentOf(mol, stayBond.a).filter((id) => id !== stayBond.a && id !== stayBond.b)
  const centre = (ids: number[], from: Molecule) =>
    ids.length === 0 ? null : { x: ids.reduce((sum, id) => sum + atomById(from, id)!.x, 0) / ids.length, y: ids.reduce((sum, id) => sum + atomById(from, id)!.y, 0) / ids.length }
  const side = (point: Point | null, p: Point, q: Point) => (point ? Math.sign((q.x - p.x) * (point.y - p.y) - (q.y - p.y) * (point.x - p.x)) : 0)
  const [t1, t2] = [at(stayBond.a), at(stayBond.b)]
  const stayingSide = side(centre(stayPiece, mol), t1, t2)
  // Two ways to lay one bond on the other; take the one that puts the moving piece across from the staying one.
  const tries = [
    [moveBond.a, moveBond.b],
    [moveBond.b, moveBond.a],
  ].map(([m1, m2]) => {
    const angle = Math.atan2(t2.y - t1.y, t2.x - t1.x) - Math.atan2(at(m2).y - at(m1).y, at(m2).x - at(m1).x)
    const laid = place(mol, split.moving, at(m1), angle, { x: t1.x - at(m1).x, y: t1.y - at(m1).y })
    const rest = split.moving.filter((id) => id !== m1 && id !== m2)
    return { m1, m2, laid, across: stayingSide === 0 || side(centre(rest, laid), t1, t2) !== stayingSide }
  })
  const chosen = tries.find((option) => option.across) ?? tries[0]
  return {
    mol: mergeAtoms(mergeAtoms(chosen.laid, stayBond.a, chosen.m1), stayBond.b, chosen.m2),
    pairs: [
      [chosen.m1, stayBond.a],
      [chosen.m2, stayBond.b],
    ],
  }
}
