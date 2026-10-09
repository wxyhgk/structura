import type { Bracket, Molecule } from "../types.ts"
import type { Attachment } from "../markush/types.ts"
import { attachmentMarks, type AttachmentMark } from "./attachments.ts"
import { bracketMarks, type BracketMark } from "./brackets.ts"
import { labelFor, type AtomLabel } from "./labels.ts"

/** The marks drawn over the structure: variable attachments and square brackets. */
export type StructureMarks = { attachments: AttachmentMark[]; brackets: BracketMark[] }

/**
 * Variable attachments and brackets as drawn, worked out together because each shapes the
 * other: a bracket is wide enough for the ellipse round its atoms. `labels` are the
 * scene's; left out, they are worked out here (as hit-testing does). The canvas, every
 * export and hit-testing all come here, so they agree.
 */
export function structureMarks(mol: Molecule, attachments: readonly Attachment[] | undefined, brackets: readonly Bracket[] | undefined, labels?: readonly AtomLabel[]): StructureMarks {
  const shown = labels ?? mol.atoms.flatMap((atom) => labelFor(mol, atom, false) ?? [])
  const attached = attachmentMarks(mol, attachments, shown)
  return { attachments: attached, brackets: bracketMarks(mol, brackets, shown, attached) }
}
