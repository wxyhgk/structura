import { addReactionArrow } from "../drawing.ts"
import { boundsCenter, tumbleAtoms } from "../molecule.ts"
import type { Drawing, HotTarget } from "../types.ts"
import { OpError, type Context } from "./context.ts"
import type { Op } from "./types.ts"

/**
 * What an op that needs the whole drawing did. `depth` is set by a tumble: how far each
 * turned atom now sits out of the page, which only the next tumble needs.
 */
export type DocumentStep = { drawing: Drawing; next?: HotTarget | null; depth?: Map<number, number> }

/**
 * Ops that need more than the molecule: arrows sit beside it on the drawing, and a tumble
 * carries out-of-page depth from one turn to the next. `depth` is what the previous op
 * left, if it was a tumble. Returns null for ops it does not handle.
 */
export function documentOp(drawing: Drawing, op: Op, ctx: Context, depth: Map<number, number> | undefined): DocumentStep | null {
  switch (op.op) {
    case "add_arrow": {
      const ids = op.atoms.map(ctx.atom)
      if (ids.length === 0) throw new OpError("an arrow needs atoms to point away from")
      return { drawing: addReactionArrow(drawing, ids, op.direction) }
    }
    case "tumble": {
      if (!Number.isFinite(op.angle)) throw new OpError(`angle ${op.angle} is not a number`)
      const mol = drawing.molecule
      const ids = op.atoms.map(ctx.atom)
      const center = op.center ?? boundsCenter(mol, ids)
      if (!center) return { drawing }
      const given = op.depth ? new Map(Object.entries(op.depth).map(([id, z]) => [Number(id), z])) : depth
      const tumbled = tumbleAtoms(mol, ids, center, op.axis, op.angle, given)
      return { drawing: { ...drawing, molecule: tumbled.mol }, depth: tumbled.depth }
    }
    default:
      return null
  }
}
