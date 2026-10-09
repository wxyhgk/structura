import type { Bracket, Molecule } from "../types.ts"
import type { Attachment } from "../markush/types.ts"
import { attachmentMarks, type AttachmentMark } from "./attachments.ts"
import { bracketMarks, type BracketMark } from "./brackets.ts"
import { labelFor, type AtomLabel } from "./labels.ts"

/** The marks drawn over the structure: variable attachments and square brackets. */
export type StructureMarks = { attachments: AttachmentMark[]; brackets: BracketMark[] }

/**
 * Variable attachments and brackets as drawn, worked out together because each shapes the
 * other: a bracket is wide enough for the ellipse round its atoms, and a bond drawn into a
 * bracket crosses its upright wherever that ends up. So: the other attachments first, then
 * the brackets round them, then the bonds into brackets. `labels` are the scene's; left
 * out, they are worked out here (as hit-testing does). The canvas, every export and
 * hit-testing all come here, so they agree.
 */
export function structureMarks(mol: Molecule, attachments: readonly Attachment[] | undefined, brackets: readonly Bracket[] | undefined, labels?: readonly AtomLabel[]): StructureMarks {
  const shown = labels ?? mol.atoms.flatMap((atom) => labelFor(mol, atom, false) ?? [])
  const first = attachmentMarks(mol, attachments, shown, { brackets })
  const drawn = bracketMarks(mol, brackets, shown, first)
  const done = new Set(first.map((mark) => mark.atom))
  const rest = (attachments ?? []).filter((attachment) => !done.has(attachment.atom))
  if (rest.length === 0) return { attachments: first, brackets: drawn }
  const uprights = new Map(drawn.map((mark) => [mark.id, mark.uprights]))
  const into = attachmentMarks(mol, rest, shown, { brackets, uprights })
  // In the drawing's order, as the canvas keys them.
  const order = new Map((attachments ?? []).map((attachment, index) => [attachment.atom, index]))
  return { attachments: [...first, ...into].sort((a, b) => order.get(a.atom)! - order.get(b.atom)!), brackets: drawn }
}
