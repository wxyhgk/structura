import { bracketInto } from "../drawing/brackets.ts"
import { ringMembership } from "../molecule/cycles.ts"
import type { Bracket, Molecule } from "../types.ts"
import type { Attachment, AttachmentShape } from "../markush/types.ts"

/**
 * How an attachment is drawn when it does not say: candidates exactly a group bracket's
 * atoms (of `brackets`) with the atom outside, a bond into the bracket; all in one ring, a
 * straight line into its middle; spread over more rings, an ellipse round them with a line
 * to it ("(R1)n anywhere on these rings") for a repeated or free-standing piece, and the
 * bond itself sweeping round them ("L2 joined at any position") for an atom bonded to the
 * rest. "bracket" asked for where no such bracket is falls back to choosing.
 */
export function attachmentShape(mol: Molecule, attachment: Attachment, brackets?: readonly Bracket[]): AttachmentShape {
  const into = bracketInto(brackets, attachment) != null
  if (attachment.shape && (attachment.shape !== "bracket" || into)) return attachment.shape
  if (into) return "bracket"
  const { rings } = ringMembership(mol)
  if (rings.some((ring) => attachment.to.every((id) => ring.includes(id)))) return "line"
  if (attachment.repeat) return "loop"
  return mol.bonds.some((bond) => bond.a === attachment.atom || bond.b === attachment.atom) ? "arc" : "loop"
}
