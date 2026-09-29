import {
  boundsCenter,
  commitChain,
  connectPoints,
  createBondAt,
  flipAtoms,
  moveAtoms,
  placeAtom,
  relax,
  rotateAtoms,
  scaleAtoms,
  sprout,
} from "../molecule.ts"
import type { Molecule } from "../types.ts"
import { OpError, type Context, type Step } from "./context.ts"
import type { Op } from "./types.ts"

/**
 * Ops that move atoms, or draw where the pointer says (joining nearby atoms the way the
 * drawing tools do). Returns null for ops it does not handle.
 */
export function drawingOp(mol: Molecule, op: Op, ctx: Context): Step | null {
  switch (op.op) {
    case "move":
      return { mol: moveAtoms(mol, op.atoms.map(ctx.atom), op.dx, op.dy) }
    case "rotate": {
      const ids = op.atoms.map(ctx.atom)
      const center = op.center ?? boundsCenter(mol, ids)
      return { mol: center ? rotateAtoms(mol, ids, center, op.angle) : mol }
    }
    case "scale": {
      if (!(op.sx > 0 && op.sy > 0)) throw new OpError("scale factors must be positive")
      const ids = op.atoms.map(ctx.atom)
      const center = op.center ?? boundsCenter(mol, ids)
      return { mol: center ? scaleAtoms(mol, ids, center, op.sx, op.sy) : mol }
    }
    case "flip":
      return { mol: flipAtoms(mol, op.atoms.map(ctx.atom), op.axis) }
    case "clean": {
      const atoms = op.atoms ? op.atoms.map(ctx.atom) : mol.atoms.map((atom) => atom.id)
      return { mol: relax(mol, { atoms, locked: (op.lock ?? []).map(ctx.atom) }) }
    }
    case "place_atom":
      ctx.element(op.el)
      return { mol: placeAtom(mol, op.el, op.at), next: null }
    case "draw_bond": {
      const style = { order: op.order ?? 1, stereo: op.stereo ?? "none", look: op.look }
      const from = op.from != null ? ctx.atom(op.from) : null
      if (op.end == null) {
        if (from != null) return { mol: sprout(mol, from, style), next: null }
        if (!op.start) throw new OpError("a bond needs a start atom, a start point or an end point")
        return { mol: createBondAt(mol, op.start, style), next: null }
      }
      const origin = from != null ? mol.atoms.find((atom) => atom.id === from)! : op.start
      if (!origin) throw new OpError("a bond needs a start atom or a start point")
      return { mol: connectPoints(mol, from, origin, op.end, style), next: null }
    }
    case "draw_chain":
      if (op.points.length < 2) throw new OpError("a chain needs at least two points")
      return { mol: commitChain(mol, op.points, op.from != null ? ctx.atom(op.from) : null), next: null }
    default:
      return null
  }
}
