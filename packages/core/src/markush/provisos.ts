import type { Proviso, Variable } from "./types.ts"
import { alternativeProblem } from "./variables.ts"

/** Why a proviso cannot be kept with these variables, or null when it can. */
export function provisoProblem(proviso: Proviso, variables: Record<string, Variable> | undefined): string | null {
  if (proviso?.kind === "compound") {
    if (typeof proviso.smiles !== "string" || !proviso.smiles.trim() || proviso.smiles.length > 1000) return "an excluded compound needs its SMILES"
    return null
  }
  if (proviso?.kind !== "combination" || !Array.isArray(proviso.when) || proviso.when.length === 0) return "a proviso needs at least one condition"
  const names = new Set<string>()
  for (const condition of proviso.when) {
    if (!variables || !Object.hasOwn(variables, condition?.name)) return `there is no variable ${condition?.name}`
    if (names.has(condition.name)) return `${condition.name} is named twice in one proviso`
    names.add(condition.name)
    if (!Array.isArray(condition.is) || condition.is.length === 0) return `the condition on ${condition.name} lists no values`
    for (const alternative of condition.is) {
      const problem = alternativeProblem(alternative)
      if (problem) return `${condition.name}: ${problem}`
    }
  }
  return null
}

/** The variables a drawing's provisos speak of. */
export function provisoNames(provisos: readonly Proviso[] | undefined): Set<string> {
  return new Set((provisos ?? []).flatMap((proviso) => (proviso.kind === "combination" ? proviso.when.map((condition) => condition.name) : [])))
}
