import { bracketInto } from "../drawing/brackets.ts"
import { ringMembership } from "../molecule/cycles.ts"
import type { Bracket, Molecule, Point } from "../types.ts"
import type { Attachment, AttachmentShape } from "./types.ts"

/**
 * How an attachment is drawn when it does not say: candidates exactly a group bracket's
 * atoms (of `brackets`) with the atom outside, a bond into the bracket; all in one ring, a
 * straight line into its middle; spread over more rings, an ellipse round them with a line
 * to it ("(R1)n anywhere on these rings") for a repeated or free-standing piece, and the
 * bond itself sweeping round them ("L2 joined at any position") for an atom bonded to the
 * rest. "bracket" asked for where no such bracket is, or "custom" with no curve, falls
 * back to choosing.
 */
export function attachmentShape(mol: Molecule, attachment: Attachment, brackets?: readonly Bracket[]): AttachmentShape {
  const into = bracketInto(brackets, attachment) != null
  const { shape } = attachment
  if (shape && (shape !== "bracket" || into) && (shape !== "custom" || attachment.curve)) return shape
  if (into) return "bracket"
  const { rings } = ringMembership(mol)
  if (rings.some((ring) => attachment.to.every((id) => ring.includes(id)))) return "line"
  if (attachment.repeat) return "loop"
  return mol.bonds.some((bond) => bond.a === attachment.atom || bond.b === attachment.atom) ? "arc" : "loop"
}

/** Where atom `id` is bonded from, as a direction pointing at it (the way its bond carries on), if it is bonded. */
export function bondHeading(mol: Molecule, id: number): Point | undefined {
  const atom = mol.atoms.find((item) => item.id === id)
  if (!atom) return undefined
  const others = mol.bonds.flatMap((bond) => (bond.a === id ? [bond.b] : bond.b === id ? [bond.a] : []))
  let x = 0
  let y = 0
  for (const otherId of others) {
    const other = mol.atoms.find((item) => item.id === otherId)
    if (!other) continue
    const length = Math.hypot(atom.x - other.x, atom.y - other.y) || 1
    x += (atom.x - other.x) / length
    y += (atom.y - other.y) / length
  }
  return others.length > 0 ? { x, y } : undefined
}
