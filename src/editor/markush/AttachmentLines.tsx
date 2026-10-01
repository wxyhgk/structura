import { memo } from "react"
import type { AtomLabel } from "@structura/core/draw"
import type { Attachment, Molecule, Point } from "@structura/core/types"

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

/**
 * Variable points of attachment: one line from the atom into the middle of its candidate
 * atoms (a ring's centre), the way patents draw "attached at any free position".
 */
export const AttachmentLines = memo(function AttachmentLines({
  mol,
  attachments,
  labels,
}: {
  mol: Molecule
  attachments: Attachment[] | undefined
  labels: AtomLabel[]
}) {
  if (!attachments || attachments.length === 0) return null
  const atoms = new Map(mol.atoms.map((atom) => [atom.id, atom]))
  return (
    <g data-testid="attachments">
      {attachments.map((attachment) => {
        const from = atoms.get(attachment.atom)
        const targets = attachment.to.flatMap((id) => atoms.get(id) ?? [])
        if (!from || targets.length === 0) return null
        const to = { x: targets.reduce((sum, atom) => sum + atom.x, 0) / targets.length, y: targets.reduce((sum, atom) => sum + atom.y, 0) / targets.length }
        const t = leaveBox(from, to, labels.find((label) => label.atomId === from.id))
        return <line key={attachment.atom} x1={from.x + (to.x - from.x) * t} y1={from.y + (to.y - from.y) * t} x2={to.x} y2={to.y} stroke="#222" strokeWidth={1.55} strokeLinecap="round" />
      })}
    </g>
  )
})
