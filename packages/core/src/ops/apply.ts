import type { Drawing, HotTarget, Molecule } from "../types.ts"
import { followBrackets, pruneBrackets } from "../drawing/brackets.ts"
import { pruneAttachments } from "../markush/attachments.ts"
import { absorbRingPointers } from "../markush/pointer.ts"
import { validateDrawing } from "../validate.ts"
import { bracketOp } from "./brackets.ts"
import { makeContext, OpError, type Context } from "./context.ts"
import { documentOp, type DocumentStep } from "./document.ts"
import { drawingOp } from "./drawing.ts"
import { structureOp } from "./structure.ts"
import type { Op, OpsResult } from "./types.ts"

/** Runs one op: the whole-drawing ops first, else the molecule's. */
function step(drawing: Drawing, op: Op, ctx: Context, depth: Map<number, number> | undefined): DocumentStep {
  const whole = documentOp(drawing, op, ctx, depth) ?? bracketOp(drawing, op, ctx)
  if (whole) return whole
  const mol = drawing.molecule
  const part = structureOp(mol, op, ctx) ?? drawingOp(mol, op, ctx)
  if (!part) throw new OpError(`unknown op "${(op as { op: string }).op}"`)
  return { drawing: part.mol === mol ? drawing : { ...drawing, molecule: part.mol }, next: part.next }
}

/**
 * The atoms a pointer op asking for `ringPointer` left where the pointer let go: the new
 * atoms of a drawn bond or chain, or one dragged atom. Other ops never change this way.
 */
function pointerEnds(op: Op, drawing: Drawing, before: number, ctx: Context): number[] {
  if ((op.op === "draw_bond" || op.op === "draw_chain") && op.ringPointer) return drawing.molecule.atoms.filter((atom) => atom.id >= before).map((atom) => atom.id)
  // A dragged atom that joined another is gone; it points into no ring.
  if (op.op === "move" && op.ringPointer && op.atoms.length === 1) {
    try {
      return [ctx.atom(op.atoms[0])]
    } catch {
      return []
    }
  }
  return []
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
  if (!Array.isArray(ops)) return { ok: false, drawing: start, index: 0, error: "ops must be a list of ops" }
  let drawing = start
  const names: Record<string, number> = {}
  let next: HotTarget | null = null
  let depth: Map<number, number> | undefined
  const ctx = makeContext(() => drawing.molecule, names)

  for (const [index, op] of ops.entries()) {
    if (typeof op !== "object" || op === null || typeof (op as { op?: unknown }).op !== "string") {
      return { ok: false, drawing: start, index, error: `op ${index} is not an op: give an object with an "op" name` }
    }
    try {
      const before = drawing.molecule.nextAtomId
      const done = step(drawing, op, ctx, depth)
      // Deleting atoms takes their variable attachments with them, and takes them out of
      // brackets; an attachment drawn into a bracket keeps the bracket's atoms as candidates.
      drawing = followBrackets(drawing, pruneBrackets(pruneAttachments(done.drawing)))
      // Drawn with the pointer tools, a line into a ring's middle is a variable attachment.
      const ends = pointerEnds(op, drawing, before, ctx)
      if (ends.length > 0) drawing = absorbRingPointers(drawing, ends)
      depth = done.depth
      if (done.next !== undefined) next = done.next
    } catch (error) {
      // A malformed op (wrong field types, a missing field) fails like any refused one: the
      // caller, an agent's loop above all, gets an answer it can act on, never a crash.
      const message = error instanceof OpError ? error.message : `op is malformed (${error instanceof Error ? error.message : String(error)})`
      return { ok: false, drawing: start, index, error: message }
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
    brackets: (drawing.brackets ?? []).filter((item) => item.id >= (start.nextBracketId ?? 1)).map((item) => item.id),
  }
  const moved = movedAtoms(start.molecule, mol)
  return { ok: true, drawing, names, problems, next, added, moved, ...(depth ? { depth: Object.fromEntries(depth) } : {}) }
}
