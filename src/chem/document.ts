import { variableProblem } from "./markush/variables.ts"
import type { Drawing } from "./types.ts"
import { errorsOf, validateDrawing } from "./validate.ts"

// Structura's own file: the whole drawing as JSON, including what MOL files cannot hold,
// such as a generic formula's variables.

const FORMAT = "structura"
const VERSION = 1

export function toDocument(drawing: Drawing): string {
  return `${JSON.stringify({ format: FORMAT, version: VERSION, drawing }, null, 2)}\n`
}

/** Whether text looks like a Structura file, before trying to read it. */
export function isDocument(text: string): boolean {
  return /^\s*\{[\s\S]*"format"\s*:\s*"structura"/.test(text.slice(0, 200))
}

/** Reads a Structura file; the error says why when it cannot be used as it is. */
export function readDocument(text: string): { drawing: Drawing } | { error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { error: "not valid JSON" }
  }
  const file = parsed as { format?: unknown; version?: unknown; drawing?: Partial<Drawing> }
  if (file?.format !== FORMAT) return { error: "not a Structura file" }
  if (typeof file.version !== "number" || file.version > VERSION) return { error: `made by a newer Structura (version ${String(file.version)})` }
  const drawing = file.drawing
  const molecule = drawing?.molecule
  if (!drawing || !molecule || !Array.isArray(molecule.atoms) || !Array.isArray(molecule.bonds) || !Array.isArray(drawing.arrows)) {
    return { error: "the drawing is incomplete" }
  }
  if (![molecule.nextAtomId, molecule.nextBondId].every(Number.isInteger)) return { error: "the drawing's id counters are missing" }
  const whole: Drawing = {
    molecule: { ...molecule, groups: molecule.groups ?? [], nextGroupId: molecule.nextGroupId ?? 1 },
    arrows: drawing.arrows,
    nextArrowId: drawing.nextArrowId ?? 1,
    ...(drawing.variables ? { variables: drawing.variables } : {}),
  }
  const errors = errorsOf(validateDrawing(whole))
  if (errors.length > 0) return { error: errors[0].message }
  for (const [name, variable] of Object.entries(whole.variables ?? {})) {
    const problem = variableProblem(name, variable, whole.variables)
    if (problem) return { error: problem }
  }
  return { drawing: whole }
}
