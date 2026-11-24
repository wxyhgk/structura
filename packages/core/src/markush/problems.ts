import type { Drawing } from "../types.ts"
import { attachmentProblem } from "./attachments.ts"
import { ringClosureProblem } from "./closures.ts"
import { generationProblem, numberingProblem } from "./numbering.ts"
import { provisoProblem } from "./provisos.ts"
import { variableProblem } from "./variables.ts"

/**
 * What is wrong with a drawing's generic-formula parts (variables, attachments, provisos, ring
 * closures, generation, numbering), or null: the first problem found. One check for a file
 * being opened and for every edit (validateDrawing), so a part a file or an op left broken is
 * caught the same way wherever it came from.
 */
export function markushProblem(drawing: Drawing): string | null {
  if (drawing.attachments != null && !Array.isArray(drawing.attachments)) return "the attachments are not a list"
  for (const attachment of drawing.attachments ?? []) {
    const problem = Array.isArray(attachment?.to) ? attachmentProblem(drawing.molecule, attachment) : "an attachment lists no atoms"
    if (problem) return problem
  }
  if (drawing.variables != null && (typeof drawing.variables !== "object" || Array.isArray(drawing.variables))) return "the variables are not a table"
  for (const [name, variable] of Object.entries(drawing.variables ?? {})) {
    const problem = variableProblem(name, variable, drawing.variables)
    if (problem) return problem
  }
  if (drawing.provisos != null && !Array.isArray(drawing.provisos)) return "the provisos are not a list"
  for (const proviso of drawing.provisos ?? []) {
    const problem = provisoProblem(proviso, drawing.variables)
    if (problem) return problem
  }
  if (drawing.ringClosures != null && !Array.isArray(drawing.ringClosures)) return "the ring closures are not a list"
  for (const closure of drawing.ringClosures ?? []) {
    const problem = ringClosureProblem(closure, drawing.variables)
    if (problem) return problem
  }
  if (drawing.generation != null) {
    const problem = generationProblem(drawing.generation)
    if (problem) return problem
  }
  if (drawing.numbering != null) {
    const problem = numberingProblem(drawing.numbering)
    if (problem) return problem
  }
  return null
}
