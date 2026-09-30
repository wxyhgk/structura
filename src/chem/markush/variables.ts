import { knownLabel } from "../label.ts"
import { BRIDGES } from "./bridges.ts"
import type { Alternative, Drawing, GroupClass, Molecule, Variable } from "../types.ts"

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

/**
 * How a variable's label may look: R, R1, R', X, L, Ar1, ETU… A short name starting with a
 * capital, optionally numbered, that is no element and no known abbreviation, so typing
 * it on an atom makes a placeholder rather than an atom or a group.
 */
const VARIABLE_SHAPE = /^[A-Z][A-Za-z]{0,3}\d{0,3}'{0,2}$/

export function isVariableName(text: string): boolean {
  return VARIABLE_SHAPE.test(text) && !knownLabel(text)
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
  return null
}

function alternativeProblem(alternative: Alternative): string | null {
  if (alternative.kind === "bond") return null
  if (alternative.kind === "bridge") return Object.hasOwn(BRIDGES, alternative.name) ? null : `unknown bridge "${alternative.name}" (${Object.keys(BRIDGES).join(", ")})`
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
  return null
}

/** The atoms standing for a variable of the drawing: those whose label names one. */
export function placeholders(drawing: Drawing): Array<{ atom: number; name: string }> {
  const variables = drawing.variables ?? {}
  return drawing.molecule.atoms.flatMap((atom) => (atom.alias && Object.hasOwn(variables, atom.alias) ? [{ atom: atom.id, name: atom.alias }] : []))
}

/** Labels on atoms that look like variables but have no definition yet, in drawing order. */
export function undefinedVariables(drawing: Drawing): string[] {
  const variables = drawing.variables ?? {}
  const names = drawing.molecule.atoms.flatMap((atom) => (atom.alias && isVariableName(atom.alias) && !Object.hasOwn(variables, atom.alias) ? [atom.alias] : []))
  return [...new Set(names)]
}

/** A molecule's placeholder atoms, whatever the variable table says: any label shaped like a variable. */
export function variableLabels(mol: Molecule): string[] {
  return [...new Set(mol.atoms.flatMap((atom) => (atom.alias && isVariableName(atom.alias) ? [atom.alias] : [])))]
}
