import { type Attachment, ringSystemPositions } from "@structura/markush"
import type { Molecule } from "@structura/core/types"

/** The whole fused system's free positions, when wider than the ring the attachment points into (carbazole from one benzo ring). */
export function widerSystem(mol: Molecule, attachment: Attachment): number[] | null {
  const all = ringSystemPositions(mol, attachment.to)
  return all && all.length > attachment.to.length && attachment.to.every((id) => all.includes(id)) ? all : null
}
