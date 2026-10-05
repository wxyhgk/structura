import assert from "node:assert/strict"
import { emptyDrawing } from "@structura/core"
import { applyOps, type Op, type OpsResult } from "@structura/core/ops"
import type { Drawing, Molecule } from "@structura/core/types"

// What most tests need: apply ops and fail clearly, build alternatives, random but
// repeatable inputs, and geometry checks. Depends on core only.

/** Applies the ops to the drawing; a failure names the op and why. */
export function run(drawing: Drawing, ops: Op[]): Drawing {
  const result = applyOps(drawing, ops)
  assert.ok(result.ok, result.ok ? "" : `op ${result.index} (${JSON.stringify(ops[result.index])}): ${result.error}`)
  return result.drawing
}

/** A drawing built from nothing by the ops. */
export const build = (ops: Op[]): Drawing => run(emptyDrawing(), ops)

/** Applies the ops and hands back the result whatever it is, for tests about refusals. */
export function tryRun(drawing: Drawing, ops: Op[]): OpsResult {
  return applyOps(drawing, ops)
}

/** A label alternative of a variable: an element or abbreviation as typed (Cl, OMe). */
export const label = (text: string) => ({ kind: "label" as const, text })

/**
 * A repeatable stream of numbers in [0, 1): the same seed gives the same inputs, so a
 * property test that fails can be run again exactly. Tests say the seed in their message.
 */
export function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

/** The shortest distance between any two atoms: how close the drawing comes to atoms overlapping. */
export function closestPair(mol: Molecule): number {
  let best = Infinity
  for (const [index, a] of mol.atoms.entries()) for (const b of mol.atoms.slice(index + 1)) best = Math.min(best, Math.hypot(a.x - b.x, a.y - b.y))
  return best
}
