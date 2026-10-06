import type { RingClosure, Variable } from "../types.ts"
import { fragmentEnds, fragmentProblem } from "./fragments.ts"

/** Why a ring closure cannot be kept with these variables, or null when it can. */
export function ringClosureProblem(closure: RingClosure, variables: Record<string, Variable> | undefined): string | null {
  for (const name of [closure?.a, closure?.b]) if (!variables || !Object.hasOwn(variables, name)) return `there is no variable ${name}`
  if (closure.a === closure.b) return "a ring closes between two different variables"
  if (!Array.isArray(closure.ring) || closure.ring.length === 0) return `say what ring ${closure.a} and ${closure.b} may form`
  for (const piece of closure.ring) {
    if (piece?.kind !== "fragment") return "a ring is given as a drawn piece with a * at each end"
    const problem = fragmentProblem(piece.molecule)
    if (problem) return problem
    if (fragmentEnds(piece.molecule).length !== 2) return "a ring piece needs a * at each end, one for each atom it joins"
  }
  return null
}

/** The variables a drawing's ring closures speak of. */
export function closureNames(closures: readonly RingClosure[] | undefined): Set<string> {
  return new Set((closures ?? []).flatMap((closure) => [closure.a, closure.b]))
}
