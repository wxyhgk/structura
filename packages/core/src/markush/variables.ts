import { knownLabel } from "../label/known.ts"
import { BRIDGES } from "./bridges.ts"
import { alsoAtProblem, fragmentProblemText, fragmentVariables } from "./fragments.ts"
import { isVariableName } from "./names.ts"
import type { Alternative, GroupClass, SizeUnit, Variable } from "../types.ts"

export { isVariableName }

/**
 * How each class's size is counted, and how many atoms a member bonds to: 1 for a group
 * that ends a branch (alkyl), 2 for one that links two atoms (arylene).
 */
export const GROUP_CLASSES: Record<GroupClass, { size: "carbons" | "members"; arity: 1 | 2 }> = {
  alkyl: { size: "carbons", arity: 1 },
  alkenyl: { size: "carbons", arity: 1 },
  alkynyl: { size: "carbons", arity: 1 },
  cycloalkyl: { size: "carbons", arity: 1 },
  heterocycloalkyl: { size: "members", arity: 1 },
  aryl: { size: "carbons", arity: 1 },
  heteroaryl: { size: "members", arity: 1 },
  alkoxy: { size: "carbons", arity: 1 },
  aryloxy: { size: "carbons", arity: 1 },
  silyl: { size: "carbons", arity: 1 },
  amino: { size: "carbons", arity: 1 },
  arylene: { size: "carbons", arity: 2 },
  heteroarylene: { size: "members", arity: 2 },
}

/** A variable's list, following "same as" to the variable that holds it; empty if undefined. */
export function alternativesOf(variables: Record<string, Variable> | undefined, name: string): Alternative[] {
  const variable = variables?.[name]
  if (!variable) return []
  if ("sameAs" in variable) {
    const source = variables?.[variable.sameAs]
    return source && "alternatives" in source ? source.alternatives : []
  }
  return variable.alternatives
}

/** The variables whose list is "same as" this one. */
export function sharers(variables: Record<string, Variable> | undefined, name: string): string[] {
  return Object.entries(variables ?? {}).flatMap(([other, variable]) => ("sameAs" in variable && variable.sameAs === name ? [other] : []))
}

/**
 * Why a variable definition is not usable among the others, or null when it is. A "same
 * as" must point at a variable with a list of its own, so there are never chains, and a
 * variable others share cannot itself become a "same as".
 */
export function variableProblem(name: string, variable: Variable, others: Record<string, Variable> = {}): string | null {
  if (!isVariableName(name)) return `"${name}" is not a variable name (like R1, X, L or ETU; not an element or an abbreviation)`
  if ("sameAs" in variable) {
    const source = others[variable.sameAs]
    if (variable.sameAs === name) return `${name} cannot share its own list`
    if (!source || !("alternatives" in source)) return `${variable.sameAs} has no list of its own for ${name} to share`
    const using = sharers(others, name)
    if (using.length > 0) return `${using.join(", ")} share ${name}'s list, so ${name} must keep one of its own`
    return null
  }
  if (variable.alternatives.length === 0) return `${name} needs at least one alternative`
  for (const alternative of variable.alternatives) {
    const problem = alternativeProblem(alternative)
    if (problem) return `${name}: ${problem}`
  }
  const loop = containing({ ...others, [name]: variable }, name)
  if (loop) return `${name} would contain itself (${loop.join(" → ")})`
  return null
}

/** The variables placeholders inside a variable's pieces stand for (R5 in Ar = N–R5), following "same as". */
export function nestedVariables(variables: Record<string, Variable> | undefined, name: string): string[] {
  return [...new Set(alternativesOf(variables, name).flatMap((item) => (item.kind === "fragment" ? fragmentVariables(item.molecule) : [])))]
}

/** A chain of pieces leading from `name` back to itself (R1 → R5 → R1), or null when there is none. */
function containing(variables: Record<string, Variable>, name: string): string[] | null {
  const walk = (current: string, path: string[]): string[] | null => {
    for (const inner of nestedVariables(variables, current)) {
      if (inner === name) return [...path, inner]
      if (!path.includes(inner)) {
        const found = walk(inner, [...path, inner])
        if (found) return found
      }
    }
    return null
  }
  return walk(name, [name])
}

/** Why one alternative is not usable, or null: what the editor's class form checks too. */
export function alternativeProblem(alternative: Alternative): string | null {
  if (alternative.kind === "bond") return null
  if (alternative.kind === "bridge") return Object.hasOwn(BRIDGES, alternative.name) ? null : `unknown bridge "${alternative.name}" (${Object.keys(BRIDGES).join(", ")})`
  if (alternative.kind === "fragment") {
    if (alternative.name != null && (typeof alternative.name !== "string" || alternative.name.length > 60)) return "a piece's name is text of at most 60 characters"
    const problem = fragmentProblemText(alternative.molecule)
    if (problem || alternative.alsoAt == null) return problem
    if (!Array.isArray(alternative.alsoAt)) return "a piece's other joining atoms are a list of its atom ids"
    return alsoAtProblem(alternative.molecule, alternative.alsoAt)
  }
  if (alternative.kind === "label") {
    const text = alternative.text.trim()
    if (!text || text.length > 32 || /[\r\n]/.test(text)) return "a label is one line of 1 to 32 characters"
    if (!knownLabel(text)) return `"${text}" is not an element or a known abbreviation; for a range such as C1-C30 use a class`
    return null
  }
  if (!Object.hasOwn(GROUP_CLASSES, alternative.class)) return `unknown class "${alternative.class}" (${Object.keys(GROUP_CLASSES).join(", ")})`
  const { min, max } = alternative
  for (const bound of [min, max]) {
    if (bound != null && (!Number.isInteger(bound) || bound < 1 || bound > 100)) return `size ${bound} is not a whole number from 1 to 100`
  }
  if (min != null && max != null && min > max) return `size ${min} is above ${max}`
  if (alternative.unit != null && alternative.unit !== "carbons" && alternative.unit !== "members") return `unit "${alternative.unit}" is neither carbons nor members`
  const carried = alternative.substituents
  if (carried != null) {
    if (!Array.isArray(carried.from) || carried.from.length === 0) return "say which groups the class may carry"
    for (const text of carried.from) if (typeof text !== "string" || !knownLabel(text)) return `"${text}" is not an element or a known abbreviation`
    if (![carried.min, carried.max].every((count) => Number.isInteger(count) && count >= 0 && count <= 5) || carried.min > carried.max || carried.max < 1) {
      return "the number of substituents is a range such as 1–3, at most 5"
    }
    if (alternative.substituted === false) return "an unsubstituted class carries no substituents"
  }
  return null
}

/** What a class alternative's size counts: its own unit, else the class's usual one. */
export function sizeUnitOf(alternative: Extract<Alternative, { kind: "class" }>): SizeUnit {
  return alternative.unit ?? GROUP_CLASSES[alternative.class].size
}
