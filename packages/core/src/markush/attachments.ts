import { atomById } from "../molecule/graph.ts"
import type { Drawing, Molecule } from "../types.ts"
import type { Attachment, AttachmentShape, Repeat } from "./types.ts"

/** Every way an attachment can be drawn, for checking what a file or an op asks for. */
export const ATTACHMENT_SHAPES: readonly AttachmentShape[] = ["line", "loop", "arc"]

/** How a repeat count may be written: a lower-case letter, optionally numbered (m, n, p1, n'). */
const COUNT_NAME = /^[a-z]\d{0,2}'?$/

/** Why a repeat cannot be on an attachment with `positions` candidates, or null when it can. */
export function repeatProblem(repeat: Repeat, positions: number): string | null {
  if (!COUNT_NAME.test(repeat.name)) return `"${repeat.name}" cannot name a count: use a lower-case letter such as m or n`
  if (!Number.isInteger(repeat.min) || !Number.isInteger(repeat.max)) return "a repeat count must be whole numbers"
  if (repeat.min < 0 || repeat.min > repeat.max) return `a repeat from ${repeat.min} to ${repeat.max} is not a range`
  if (repeat.max > positions) return `it can appear at most ${positions} times: there are only ${positions} positions`
  return null
}

/** Why an attachment cannot be made, or null when it can. */
export function attachmentProblem(mol: Molecule, attachment: Attachment): string | null {
  const to = new Set(attachment.to)
  if (to.size < 2) return "a variable attachment needs at least two atoms to choose from"
  if (to.has(attachment.atom)) return `atom #${attachment.atom} cannot be one of its own candidates`
  for (const id of [attachment.atom, ...to]) if (!atomById(mol, id)) return `there is no atom #${id}`
  if (attachment.shape !== undefined && !ATTACHMENT_SHAPES.includes(attachment.shape)) return `"${String(attachment.shape)}" is not a way to draw an attachment: use line, loop or arc`
  return attachment.repeat ? repeatProblem(attachment.repeat, to.size) : null
}

/** The drawing without attachments that refer to atoms since deleted; one left with fewer than two candidates goes. */
export function pruneAttachments(drawing: Drawing): Drawing {
  if (!drawing.attachments) return drawing
  const mol = drawing.molecule
  const kept = drawing.attachments.flatMap((attachment) => {
    if (!atomById(mol, attachment.atom)) return []
    const to = attachment.to.filter((id) => atomById(mol, id))
    if (to.length < 2) return []
    if (to.length === attachment.to.length) return [attachment]
    // Fewer positions than the count allowed: the count shrinks with them.
    const repeat = attachment.repeat && { ...attachment.repeat, max: Math.min(attachment.repeat.max, to.length), min: Math.min(attachment.repeat.min, to.length) }
    return [{ ...attachment, to, ...(repeat ? { repeat } : {}) }]
  })
  const unchanged = kept.length === drawing.attachments.length && kept.every((item, index) => item === drawing.attachments![index])
  if (unchanged) return drawing
  return { ...drawing, attachments: kept.length > 0 ? kept : undefined }
}
