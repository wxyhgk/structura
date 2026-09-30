import { atomById } from "../molecule/graph.ts"
import type { Attachment, Drawing, Molecule } from "../types.ts"

/** Why an attachment cannot be made, or null when it can. */
export function attachmentProblem(mol: Molecule, attachment: Attachment): string | null {
  const to = new Set(attachment.to)
  if (to.size < 2) return "a variable attachment needs at least two atoms to choose from"
  if (to.has(attachment.atom)) return `atom #${attachment.atom} cannot be one of its own candidates`
  for (const id of [attachment.atom, ...to]) if (!atomById(mol, id)) return `there is no atom #${id}`
  return null
}

/** The drawing without attachments that refer to atoms since deleted; one left with fewer than two candidates goes. */
export function pruneAttachments(drawing: Drawing): Drawing {
  if (!drawing.attachments) return drawing
  const mol = drawing.molecule
  const kept = drawing.attachments.flatMap((attachment) => {
    if (!atomById(mol, attachment.atom)) return []
    const to = attachment.to.filter((id) => atomById(mol, id))
    return to.length >= 2 ? [to.length === attachment.to.length ? attachment : { ...attachment, to }] : []
  })
  const unchanged = kept.length === drawing.attachments.length && kept.every((item, index) => item === drawing.attachments![index])
  if (unchanged) return drawing
  return { ...drawing, attachments: kept.length > 0 ? kept : undefined }
}
