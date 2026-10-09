import { isVariableName, nestedVariables, sharers, type Variable } from "@structura/core/markush"
import type { Drawing, Molecule } from "@structura/core/types"

// Questions about a generic formula's variables, for the panel and for expanding it.

/**
 * The variables `name` could share a list with: those with a list of their own. None when
 * others already share `name`'s list, since then it must keep its own (no chains).
 */
export function shareSources(variables: Record<string, Variable> | undefined, name: string): string[] {
  if (sharers(variables, name).length > 0) return []
  return Object.entries(variables ?? {}).flatMap(([other, variable]) => (other !== name && "alternatives" in variable ? [other] : []))
}

/** The atoms standing for a variable of the drawing: those whose label names one. */
export function placeholders(drawing: Drawing): Array<{ atom: number; name: string }> {
  const variables = drawing.variables ?? {}
  return drawing.molecule.atoms.flatMap((atom) => (atom.alias && Object.hasOwn(variables, atom.alias) ? [{ atom: atom.id, name: atom.alias }] : []))
}

/** Labels that look like variables but have no definition yet: on atoms in drawing order, then inside pieces. */
export function undefinedVariables(drawing: Drawing): string[] {
  const variables = drawing.variables ?? {}
  const drawn = drawing.molecule.atoms.flatMap((atom) => (atom.alias && isVariableName(atom.alias) ? [atom.alias] : []))
  const inPieces = Object.keys(variables).flatMap((name) => nestedVariables(variables, name))
  return [...new Set([...drawn, ...inPieces])].filter((name) => !Object.hasOwn(variables, name))
}

/** A molecule's placeholder atoms, whatever the variable table says: any label shaped like a variable. */
export function variableLabels(mol: Molecule): string[] {
  return [...new Set(mol.atoms.flatMap((atom) => (atom.alias && isVariableName(atom.alias) ? [atom.alias] : [])))]
}
