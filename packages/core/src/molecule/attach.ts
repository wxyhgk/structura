import { angleTo, pointFrom } from "../geometry.ts"
import type { Molecule } from "../types.ts"
import { sproutAngle } from "./angles.ts"
import { addBond, atomById, spliceIn } from "./graph.ts"
import { bondLengthAt } from "./measure.ts"

/**
 * Puts a whole `piece` onto atom `anchor` by its atom `head`: one bond out from the anchor,
 * the way a substituent grows there, turned so the piece's own way out of `head` points
 * back at the anchor, and joined by a single bond. The piece keeps its shape (a template's
 * rings stay regular); it is scaled to the drawing's bond length. Returns the molecule and
 * each piece atom's new id.
 */
export function attachPiece(mol: Molecule, anchor: number, piece: Molecule, head: number): { mol: Molecule; ids: Map<number, number> } {
  const from = atomById(mol, anchor)
  const start = atomById(piece, head)
  if (!from || !start) throw new Error(`attachPiece: atom #${from ? head : anchor} is missing`)
  // Angles here are the drawing's (counterclockwise as drawn); pointFrom and angleTo keep to them.
  const out = sproutAngle(mol, anchor)
  const length = bondLengthAt(mol, anchor)
  const spot = pointFrom(from, out, length)
  const turn = out + Math.PI - sproutAngle(piece, head)
  const scale = length / bondLengthAt(piece, head)
  const placed: Molecule = {
    ...piece,
    atoms: piece.atoms.map((atom) => {
      if (atom.id === head) return { ...atom, x: spot.x, y: spot.y }
      const at = pointFrom(spot, angleTo(start, atom) + turn, Math.hypot(atom.x - start.x, atom.y - start.y) * scale)
      return { ...atom, x: at.x, y: at.y }
    }),
  }
  const spliced = spliceIn(mol, placed, 0, 0)
  const ids = new Map(piece.atoms.map((atom, index) => [atom.id, spliced.ids[index]]))
  const joined = addBond(spliced.mol, anchor, ids.get(head)!, { order: 1, stereo: "none" })
  return { mol: joined?.mol ?? spliced.mol, ids }
}
