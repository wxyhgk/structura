import { atomById, bondLengthAt, neighbors } from "@structura/core/molecule"
import { fragmentEnds } from "@structura/core/markush"
import type { Molecule, Point } from "@structura/core/types"

// A drawn piece joined by atoms other than the one its "*" marks are on (alsoAt): each
// way it joins is a version of the piece for expanding the formula.

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * The piece joined by another of its atoms: its "*" marks moved onto `head`, pointing away
 * from that atom's bonds (two marks, for a ring atom, splayed either side).
 */
export function fragmentAt(piece: Molecule, head: number): Molecule {
  const ends = fragmentEnds(piece)
  const stars = new Set(ends.map((end) => end.star))
  const centre = atomById(piece, head)
  if (!centre || stars.has(head) || ends.length === 0) return piece
  const length = ends[0].head > 0 ? dist(atomById(piece, ends[0].head)!, atomById(piece, ends[0].star)!) : bondLengthAt(piece)
  const others = neighbors(piece, head).filter((atom) => !stars.has(atom.id))
  const pull = others.reduce((sum, atom) => ({ x: sum.x + atom.x - centre.x, y: sum.y + atom.y - centre.y }), { x: 0, y: 0 })
  const away = pull.x === 0 && pull.y === 0 ? 0 : Math.atan2(-pull.y, -pull.x)
  const spread = ends.length > 1 ? [-0.6, 0.6] : [0]
  const kept = piece.bonds.filter((bond) => !stars.has(bond.a) && !stars.has(bond.b))
  const atoms = piece.atoms.map((atom) => {
    const index = ends.findIndex((end) => end.star === atom.id)
    if (index < 0) return atom
    const angle = away + (spread[index] ?? 0)
    return { ...atom, x: centre.x + Math.cos(angle) * length, y: centre.y + Math.sin(angle) * length }
  })
  const joins = ends.map((end, index) => ({ id: piece.nextBondId + index, a: head, b: end.star, order: 1 as const, stereo: "none" as const }))
  return { ...piece, atoms, bonds: [...kept, ...joins], nextBondId: piece.nextBondId + ends.length }
}

/** Every way a piece alternative joins: as drawn, then by each of its other joining atoms. */
export function fragmentVersions(piece: Molecule, alsoAt: number[] = []): Molecule[] {
  return [piece, ...alsoAt.map((head) => fragmentAt(piece, head))]
}
