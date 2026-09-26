import type { HotTarget } from "../hotkeys.ts"
import type { Molecule } from "../types.ts"
import { validate } from "../validate.ts"
import { makeContext, OpError } from "./context.ts"
import { drawingOp } from "./drawing.ts"
import { structureOp } from "./structure.ts"
import type { Op, OpsResult } from "./types.ts"

/**
 * Applies a batch of edits all or nothing: if any op fails, nothing changes and the result
 * says which op and why. The whole batch is one step for undo.
 */
export function applyOps(start: Molecule, ops: Op[]): OpsResult {
  let mol = start
  const names: Record<string, number> = {}
  let next: HotTarget | null = null
  const ctx = makeContext(() => mol, names)

  for (const [index, op] of ops.entries()) {
    try {
      const step = structureOp(mol, op, ctx) ?? drawingOp(mol, op, ctx)
      if (!step) throw new OpError(`unknown op "${(op as { op: string }).op}"`)
      mol = step.mol
      if (step.next !== undefined) next = step.next
    } catch (error) {
      if (!(error instanceof OpError)) throw error
      return { ok: false, mol: start, index, error: error.message }
    }
  }

  const problems = validate(mol)
  const broken = problems.find((problem) => problem.severity === "error")
  if (broken) return { ok: false, mol: start, index: ops.length - 1, error: `the edit would break the molecule: ${broken.message}` }
  const added = {
    atoms: mol.atoms.filter((item) => item.id >= start.nextAtomId).map((item) => item.id),
    bonds: mol.bonds.filter((item) => item.id >= start.nextBondId).map((item) => item.id),
  }
  return { ok: true, mol, names, problems, next, added }
}
