import type { Molecule, Point } from "../types.ts"
import type { Attachment, AttachmentShape } from "../markush/types.ts"
import { arcJoin, arcPath, ellipseBounds, ellipsePoint, fitEllipse, loopPath, nearestOnEllipse } from "./attachmentCurve.ts"
import { attachmentShape } from "./attachmentShape.ts"
import type { AtomLabel } from "./labels.ts"

/** Text drawn beside a label: the brackets and count of "(R1)m". */
export type MarkText = { text: string; x: number; y: number; size: number; anchor: "start" | "end"; italic: boolean; color: string }

/** A box in drawing coordinates. */
export type Extent = { left: number; right: number; top: number; bottom: number }

/**
 * One variable point of attachment as drawn: its `shape`, the stroke as an SVG path (`from`
 * where it leaves the atom, `to` where it meets the ring's middle or the ellipse), the box
 * round all of it, and the repeat marks if any.
 */
export type AttachmentMark = { atom: number; shape: AttachmentShape; from: Point; to: Point; path: string; bounds: Extent; texts: MarkText[] }

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

const fixed = (p: Point) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`

/** The box round some points and, if given, a box. */
function extentOf(points: Point[], box?: Extent): Extent {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return {
    left: Math.min(...xs, box?.left ?? Infinity),
    right: Math.max(...xs, box?.right ?? -Infinity),
    top: Math.min(...ys, box?.top ?? Infinity),
    bottom: Math.max(...ys, box?.bottom ?? -Infinity),
  }
}

/** Where `atom` is bonded from, as a direction pointing at it (the way its bond carries on), if it is bonded. */
function heading(mol: Molecule, atom: Point & { id: number }): Point | undefined {
  const others = mol.bonds.flatMap((bond) => (bond.a === atom.id ? [bond.b] : bond.b === atom.id ? [bond.a] : []))
  let x = 0
  let y = 0
  for (const id of others) {
    const other = mol.atoms.find((item) => item.id === id)
    if (!other) continue
    const length = Math.hypot(atom.x - other.x, atom.y - other.y) || 1
    x += (atom.x - other.x) / length
    y += (atom.y - other.y) / length
  }
  return others.length > 0 ? { x, y } : undefined
}

/**
 * Variable points of attachment as patents draw them, by their shape: a line from the atom
 * (leaving its label) into the middle of one ring; an ellipse round a fused system with a
 * line to it; or the bond sweeping round the system as an open curve. "(R1)m" when it
 * repeats. Shared by the canvas and every export, so they look the same, and recomputed from
 * the atoms, so a curve follows them as they move.
 */
export function attachmentMarks(mol: Molecule, attachments: readonly Attachment[] | undefined, labels: readonly AtomLabel[]): AttachmentMark[] {
  if (!attachments) return []
  const atoms = new Map(mol.atoms.map((atom) => [atom.id, atom]))
  return attachments.flatMap((attachment): AttachmentMark[] => {
    const from = atoms.get(attachment.atom)
    const targets = attachment.to.flatMap((id) => atoms.get(id) ?? [])
    if (!from || targets.length === 0) return []
    const label = labels.find((item) => item.atomId === from.id)
    const texts = attachment.repeat && label ? repeatTexts(label, attachment.repeat.name) : []
    const shape = attachmentShape(mol, attachment)
    const leaving = (toward: Point) => {
      const t = leaveBox(from, toward, label)
      return { x: from.x + (toward.x - from.x) * t, y: from.y + (toward.y - from.y) * t }
    }
    if (shape === "line") {
      const to = { x: targets.reduce((sum, atom) => sum + atom.x, 0) / targets.length, y: targets.reduce((sum, atom) => sum + atom.y, 0) / targets.length }
      const start = leaving(to)
      return [{ atom: attachment.atom, shape, from: start, to, path: `M ${fixed(start)} L ${fixed(to)}`, bounds: extentOf([start, to]), texts }]
    }
    const ellipse = fitEllipse(targets)
    const bounds = (start: Point, end: Point) => extentOf([start, end], ellipseBounds(ellipse))
    if (shape === "arc") {
      const join = arcJoin(ellipse, from, heading(mol, from))
      const start = leaving(join.point)
      return [{ atom: attachment.atom, shape, from: start, to: join.point, path: arcPath(start, ellipse, join), bounds: bounds(start, join.point), texts }]
    }
    // The line leaves the label towards the ellipse's nearest point.
    const start = leaving(ellipsePoint(ellipse, nearestOnEllipse(ellipse, from)))
    const { path, end } = loopPath(start, ellipse)
    return [{ atom: attachment.atom, shape, from: start, to: end, path, bounds: bounds(start, end), texts }]
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
