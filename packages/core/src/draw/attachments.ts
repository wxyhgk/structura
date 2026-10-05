import type { Attachment, Molecule, Point } from "../types.ts"
import type { AtomLabel } from "./labels.ts"

/** Text drawn beside a label: the brackets and count of "(R1)m". */
export type MarkText = { text: string; x: number; y: number; size: number; anchor: "start" | "end"; italic: boolean; color: string }

/** One variable point of attachment as drawn: the line into the ring, and the repeat marks if any. */
export type AttachmentMark = { atom: number; from: Point; to: Point; texts: MarkText[] }

/** How far along the way from `from` to `to` the line leaves a label's box, padded a little. */
function leaveBox(from: Point, to: Point, label: AtomLabel | undefined): number {
  if (!label) return 0
  const dx = to.x - from.x
  const dy = to.y - from.y
  const pad = 2
  const exits = [
    dx > 0 ? (label.box.right + pad - from.x) / dx : dx < 0 ? (label.box.left - pad - from.x) / dx : Infinity,
    dy > 0 ? (label.box.bottom + pad - from.y) / dy : dy < 0 ? (label.box.top - pad - from.y) / dy : Infinity,
  ]
  return Math.max(0, Math.min(1, ...exits))
}

/** "(R1)m": brackets around the attached label, the count written small and italic after it. */
function repeatTexts(label: AtomLabel, name: string): MarkText[] {
  const { size, y } = label.runs[0]
  const mark = { y, size, italic: false, color: label.color }
  return [
    { ...mark, text: "(", x: label.box.left + size * 0.18, anchor: "end" },
    { ...mark, text: ")", x: label.box.right - size * 0.18, anchor: "start" },
    { ...mark, text: name, x: label.box.right + size * 0.16, y: y + size * 0.38, size: size * 0.7, italic: true, anchor: "start" },
  ]
}

/**
 * Variable points of attachment as patents draw them: one line from the atom (leaving its
 * label) into the middle of its candidate atoms, and "(R1)m" when it repeats. Shared by
 * the canvas and every export, so they look the same.
 */
export function attachmentMarks(mol: Molecule, attachments: readonly Attachment[] | undefined, labels: readonly AtomLabel[]): AttachmentMark[] {
  if (!attachments) return []
  const atoms = new Map(mol.atoms.map((atom) => [atom.id, atom]))
  return attachments.flatMap((attachment) => {
    const from = atoms.get(attachment.atom)
    const targets = attachment.to.flatMap((id) => atoms.get(id) ?? [])
    if (!from || targets.length === 0) return []
    const to = { x: targets.reduce((sum, atom) => sum + atom.x, 0) / targets.length, y: targets.reduce((sum, atom) => sum + atom.y, 0) / targets.length }
    const label = labels.find((item) => item.atomId === from.id)
    const t = leaveBox(from, to, label)
    const start = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
    return [{ atom: attachment.atom, from: start, to, texts: attachment.repeat && label ? repeatTexts(label, attachment.repeat.name) : [] }]
  })
}

/** Roughly how far a mark's text reaches, for fitting an export's bounds around it. */
export function markTextExtent(text: MarkText): { left: number; right: number; top: number; bottom: number } {
  const width = text.text.length * text.size * 0.6
  return {
    left: text.anchor === "end" ? text.x - width : text.x,
    right: text.anchor === "end" ? text.x : text.x + width,
    top: text.y - text.size * 0.6,
    bottom: text.y + text.size * 0.6,
  }
}
