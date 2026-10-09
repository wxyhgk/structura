import { ringMembership } from "../molecule/cycles.ts"
import type { Molecule } from "../types.ts"
import type { Attachment, AttachmentShape } from "../markush/types.ts"

/**
 * How an attachment is drawn when it does not say: candidates all in one ring, a straight
 * line into its middle; spread over more rings, an ellipse round them with a line to it
 * ("(R1)n anywhere on these rings") for a repeated or free-standing piece, and the bond
 * itself sweeping round them ("L2 joined at any position") for an atom bonded to the rest.
 */
export function attachmentShape(mol: Molecule, attachment: Attachment): AttachmentShape {
  if (attachment.shape) return attachment.shape
  const { rings } = ringMembership(mol)
  if (rings.some((ring) => attachment.to.every((id) => ring.includes(id)))) return "line"
  if (attachment.repeat) return "loop"
  return mol.bonds.some((bond) => bond.a === attachment.atom || bond.b === attachment.atom) ? "arc" : "loop"
}
