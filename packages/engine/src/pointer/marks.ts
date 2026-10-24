import { structureMarks, type StructureMarks } from "@structura/core/draw"
import type { Attachment } from "@structura/markush"
import type { Bracket, Molecule } from "@structura/core/types"

/** The last drawing's marks: the pointer asks on every move, and the drawing seldom changes between. */
let last: { mol: Molecule; attachments?: readonly Attachment[]; brackets?: readonly Bracket[]; marks: StructureMarks } | null = null

/** The brackets and attachments as drawn (structureMarks), worked out again only when the drawing changes. */
export function marksOf(mol: Molecule, attachments: readonly Attachment[] | undefined, brackets: readonly Bracket[] | undefined): StructureMarks {
  if (last?.mol !== mol || last.attachments !== attachments || last.brackets !== brackets) last = { mol, attachments, brackets, marks: structureMarks(mol, attachments, brackets) }
  return last.marks
}
