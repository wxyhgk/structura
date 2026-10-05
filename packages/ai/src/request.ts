import { linkerNames, variableLabels } from "@structura/markush"
import type { Drawing } from "@structura/core/types"
import type { FillRequest } from "./types.ts"

/** The request for a drawing: every variable drawn or defined, where it sits, and what it is now. */
export function requestFor(drawing: Drawing, text: string): FillRequest {
  const drawn = variableLabels(drawing.molecule)
  const linkers = linkerNames(drawing)
  const names = [...new Set([...drawn, ...Object.keys(drawing.variables ?? {})])]
  return {
    text,
    variables: names.map((name) => ({ name, linker: linkers.has(name), onDrawing: drawn.includes(name), current: drawing.variables?.[name] ?? null })),
  }
}
