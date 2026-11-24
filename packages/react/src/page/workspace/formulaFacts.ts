import { alternativesOf, nestedVariables, repeatSkips, type RepeatSkip, variableLabels } from "@structura/markush"
import type { Drawing } from "@structura/core/types"

/** What the constraints pane says about the formula's variables at a glance. */
export type FormulaFacts = {
  /** Every variable: on the drawing, defined, or inside a defined variable's pieces. */
  names: string[]
  /** Variables with at least one candidate. */
  defined: string[]
  /** Variables in use (on the drawing or inside a piece) with no candidate yet. */
  undefinedNames: string[]
  /** Variables defined but neither on the drawing nor inside another variable's pieces. */
  unused: string[]
  /** The repeat units [ … ]n, by their count's name and range ("n = 1–4"). */
  repeats: string[]
  /** Repeat units that cannot be written out when generating. */
  skippedRepeats: RepeatSkip[]
}

/** The facts the overview shows, from the drawing as it stands. */
export function formulaFacts(drawing: Drawing): FormulaFacts {
  const { variables } = drawing
  const onDrawing = variableLabels(drawing.molecule)
  const listed = Object.keys(variables ?? {})
  const nested = new Set(listed.flatMap((name) => nestedVariables(variables, name)))
  const names = [...new Set([...onDrawing, ...listed, ...nested])]
  const defined = names.filter((name) => alternativesOf(variables, name).length > 0)
  const undefinedNames = names.filter((name) => !defined.includes(name) && (onDrawing.includes(name) || nested.has(name)))
  const unused = listed.filter((name) => !onDrawing.includes(name) && !nested.has(name))
  const repeats = (drawing.brackets ?? []).flatMap((bracket) => (bracket.kind === "repeat" && bracket.repeat ? [`${bracket.repeat.name} = ${bracket.repeat.min}–${bracket.repeat.max}`] : []))
  return { names, defined, undefinedNames, unused, repeats, skippedRepeats: repeatSkips(drawing) }
}
