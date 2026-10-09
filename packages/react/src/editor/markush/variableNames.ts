import { alternativesOf, type Attachment, linkerNames, nestedVariables, ringNames, type SiteKind, type Variable, variableLabels } from "@structura/markush"
import type { Molecule } from "@structura/core/types"

/** The variables a formula has to show, and where each one stands. */
export type VariableNames = {
  /** Every name to show: placeholders on the drawing, defined variables, and placeholders inside their pieces. */
  names: string[]
  /** Placeholder labels on the drawing itself. */
  onDrawing: string[]
  /** Placeholders inside the variables' pieces (R5 in Ar = N–R5), which need defining too. */
  nested: Set<string>
  /** Variables that sit between two atoms (like L). */
  linkers: Set<string>
  /** Where a variable sits: end of a branch, linker, or ring atom. */
  siteOf: (name: string) => SiteKind
}

/** Which variables the formula has, from its drawing and its definitions (pieces included). */
export function variableNames(mol: Molecule, variables: Record<string, Variable> | undefined, attachments: Attachment[] | undefined): VariableNames {
  const onDrawing = variableLabels(mol)
  const defined = Object.keys(variables ?? {})
  const nested = new Set(defined.flatMap((name) => nestedVariables(variables, name)))
  const pieces = defined.flatMap((name) => alternativesOf(variables, name).flatMap((item) => (item.kind === "fragment" ? [item.molecule] : [])))
  const drawings = [mol, ...pieces].map((molecule) => ({ molecule, arrows: [], nextArrowId: 0, attachments: molecule === mol ? attachments : undefined }))
  const linkers = new Set(drawings.flatMap((drawing) => [...linkerNames(drawing)]))
  const rings = new Set(drawings.flatMap((drawing) => [...ringNames(drawing)]))
  const siteOf = (name: string): SiteKind => (rings.has(name) ? "ring" : linkers.has(name) ? "link" : "end")
  const names = [...new Set([...onDrawing, ...defined, ...nested])]
  return { names, onDrawing, nested, linkers, siteOf }
}
