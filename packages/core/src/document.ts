import { attachmentProblem } from "./markush/attachments.ts"
import { ringClosureProblem } from "./markush/closures.ts"
import { provisoProblem } from "./markush/provisos.ts"
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

/** The bracket counter as saved, or one past the highest id when a file left it out. */
function bracketCounter(drawing: Partial<Drawing>): Pick<Drawing, "nextBracketId"> {
  if (drawing.nextBracketId != null) return { nextBracketId: drawing.nextBracketId }
  if (!Array.isArray(drawing.brackets) || drawing.brackets.length === 0) return {}
  return { nextBracketId: Math.max(0, ...drawing.brackets.map((bracket) => (Number.isInteger(bracket?.id) ? bracket.id : 0))) + 1 }
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
    ...(drawing.attachments ? { attachments: drawing.attachments } : {}),
    ...(drawing.provisos ? { provisos: drawing.provisos } : {}),
    ...(drawing.ringClosures ? { ringClosures: drawing.ringClosures } : {}),
    ...(drawing.brackets ? { brackets: drawing.brackets } : {}),
    ...bracketCounter(drawing),
  }
  const errors = errorsOf(validateDrawing(whole))
  if (errors.length > 0) return { error: errors[0].message }
  for (const attachment of whole.attachments ?? []) {
    const problem = Array.isArray(attachment?.to) ? attachmentProblem(whole.molecule, attachment) : "an attachment lists no atoms"
    if (problem) return { error: problem }
  }
  for (const [name, variable] of Object.entries(whole.variables ?? {})) {
    const problem = variableProblem(name, variable, whole.variables)
    if (problem) return { error: problem }
  }
  if (whole.provisos != null && !Array.isArray(whole.provisos)) return { error: "the provisos are not a list" }
  for (const proviso of whole.provisos ?? []) {
    const problem = provisoProblem(proviso, whole.variables)
    if (problem) return { error: problem }
  }
  if (whole.ringClosures != null && !Array.isArray(whole.ringClosures)) return { error: "the ring closures are not a list" }
  for (const closure of whole.ringClosures ?? []) {
    const problem = ringClosureProblem(closure, whole.variables)
    if (problem) return { error: problem }
  }
  return { drawing: whole }
}
