import { pointInPolygon } from "../geometry.ts"
import { atomById } from "../molecule.ts"
import { smallestRings } from "../molecule/cycles.ts"
import type { Attachment, Drawing, Molecule, Point } from "../types.ts"

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

/**
 * The ring whose inside the point is in, as the atoms a substituent could hang from: the
 * ring's atoms that are in no other ring (not the fusion atoms). Null when the point is in
 * no ring, the ring contains `except` (the atom the line starts from), or it leaves fewer
 * than two such atoms.
 */
export function ringPositionsAt(mol: Molecule, point: Point, except?: number): number[] | null {
  const rings = smallestRings(mol)
  const inRings = new Map<number, number>()
  for (const ring of rings) for (const id of ring) inRings.set(id, (inRings.get(id) ?? 0) + 1)
  const ring = rings.find((ids) => pointInPolygon(point, ids.map((id) => atomById(mol, id)!)))
  if (!ring || (except != null && ring.includes(except))) return null
  const positions = ring.filter((id) => inRings.get(id) === 1)
  return positions.length >= 2 ? positions : null
}
