import { fragmentEnds } from "@structura/core/markush"
import { addBond, bondLengthAt, componentOf, deleteSelection, neighbors, spliceIn, subMolecule } from "@structura/core/molecule"
import { applyOps } from "@structura/core/ops"
import type { Drawing, Molecule, RingClosure } from "@structura/core/types"

/**
 * "R1 and R2 together form a ring": the two placeholders go, and the ring piece joins the
 * atoms they hung from, its first "*" end to `a`'s atom and its second to `b`'s, set just
 * outside them and tidied (nothing else moves). Null when it cannot close here: each
 * variable must sit once, at a branch end, on two different atoms.
 */
export function closeRing(drawing: Drawing, closure: RingClosure, piece: Molecule): Drawing | null {
  const mol = drawing.molecule
  const carrying = (name: string) => mol.atoms.filter((atom) => atom.alias === name)
  const [a, b] = [carrying(closure.a), carrying(closure.b)]
  if (a.length !== 1 || b.length !== 1) return null
  const [hubA, hubB] = [neighbors(mol, a[0].id), neighbors(mol, b[0].id)]
  if (hubA.length !== 1 || hubB.length !== 1 || hubA[0].id === hubB[0].id) return null
  const ends = fragmentEnds(piece)
  if (ends.length !== 2 || ends[0].head === ends[1].head) return null

  // Where the piece goes: past the middle of the two atoms, away from the rest of their molecule.
  const rest = componentOf(mol, hubA[0].id).flatMap((id) => mol.atoms.filter((atom) => atom.id === id && atom.id !== a[0].id && atom.id !== b[0].id))
  const centre = { x: rest.reduce((sum, atom) => sum + atom.x, 0) / rest.length, y: rest.reduce((sum, atom) => sum + atom.y, 0) / rest.length }
  const middle = { x: (hubA[0].x + hubB[0].x) / 2, y: (hubA[0].y + hubB[0].y) / 2 }
  const away = { x: middle.x - centre.x, y: middle.y - centre.y }
  const length = Math.hypot(away.x, away.y) || 1
  const step = bondLengthAt(mol)
  const target = { x: middle.x + (away.x / length) * step, y: middle.y + (away.y / length) * step }

  const inner = subMolecule(piece, piece.atoms.filter((atom) => atom.alias !== "*").map((atom) => atom.id))
  const pieceCentre = { x: inner.atoms.reduce((sum, atom) => sum + atom.x, 0) / inner.atoms.length, y: inner.atoms.reduce((sum, atom) => sum + atom.y, 0) / inner.atoms.length }
  const freed = deleteSelection(mol, { atoms: [a[0].id, b[0].id], bonds: [] })
  const placed = spliceIn(freed, inner, target.x - pieceCentre.x, target.y - pieceCentre.y)
  const idOf = (head: number) => placed.ids[inner.atoms.findIndex((atom) => atom.id === head)]
  let joined = addBond(placed.mol, idOf(ends[0].head), hubA[0].id, { order: 1, stereo: "none" })?.mol
  joined = joined && addBond(joined, idOf(ends[1].head), hubB[0].id, { order: 1, stereo: "none" })?.mol
  if (!joined) return null
  const tidied = applyOps({ ...drawing, molecule: joined }, [{ op: "clean", atoms: placed.ids, lock: [hubA[0].id, hubB[0].id] }])
  return tidied.ok ? tidied.drawing : { ...drawing, molecule: joined }
}
