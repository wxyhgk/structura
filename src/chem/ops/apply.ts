import type { Drawing, HotTarget, Molecule } from "../types.ts"
import { pruneAttachments } from "../markush/attachments.ts"
import { validateDrawing } from "../validate.ts"
import { makeContext, OpError, type Context } from "./context.ts"
import { documentOp, type DocumentStep } from "./document.ts"
import { drawingOp } from "./drawing.ts"
import { structureOp } from "./structure.ts"
import type { Op, OpsResult } from "./types.ts"

/** Runs one op: the whole-drawing ops first, else the molecule's. */
function step(drawing: Drawing, op: Op, ctx: Context, depth: Map<number, number> | undefined): DocumentStep {
  const whole = documentOp(drawing, op, ctx, depth)
  if (whole) return whole
  const mol = drawing.molecule
  const part = structureOp(mol, op, ctx) ?? drawingOp(mol, op, ctx)
  if (!part) throw new OpError(`unknown op "${(op as { op: string }).op}"`)
  return { drawing: part.mol === mol ? drawing : { ...drawing, molecule: part.mol }, next: part.next }
}

/** Atoms present both before and after whose coordinates differ. */
function movedAtoms(before: Molecule, after: Molecule): number[] {
  const was = new Map(before.atoms.map((atom) => [atom.id, atom]))
  return after.atoms
    .filter((atom) => {
      const old = was.get(atom.id)
      return old != null && (old.x !== atom.x || old.y !== atom.y)
    })
    .map((atom) => atom.id)
}

/**
 * Applies a batch of edits to the drawing all or nothing: if any op fails, nothing changes
 * and the result says which op and why. The whole batch is one step for undo.
 */
export function applyOps(start: Drawing, ops: Op[]): OpsResult {
  let drawing = start
  const names: Record<string, number> = {}
  let next: HotTarget | null = null
  let depth: Map<number, number> | undefined
  const ctx = makeContext(() => drawing.molecule, names)

  for (const [index, op] of ops.entries()) {
    try {
      const done = step(drawing, op, ctx, depth)
      // Deleting atoms takes their variable attachments with them.
      drawing = pruneAttachments(done.drawing)
      depth = done.depth
      if (done.next !== undefined) next = done.next
    } catch (error) {
      if (!(error instanceof OpError)) throw error
      return { ok: false, drawing: start, index, error: error.message }
    }
  }

  const problems = validateDrawing(drawing)
  const broken = problems.find((problem) => problem.severity === "error")
  if (broken) return { ok: false, drawing: start, index: ops.length - 1, error: `the edit would break the drawing: ${broken.message}` }
  const mol = drawing.molecule
  const added = {
    atoms: mol.atoms.filter((item) => item.id >= start.molecule.nextAtomId).map((item) => item.id),
    bonds: mol.bonds.filter((item) => item.id >= start.molecule.nextBondId).map((item) => item.id),
    arrows: drawing.arrows.filter((item) => item.id >= start.nextArrowId).map((item) => item.id),
  }
  const moved = movedAtoms(start.molecule, mol)
  return { ok: true, drawing, names, problems, next, added, moved, ...(depth ? { depth: Object.fromEntries(depth) } : {}) }
}
