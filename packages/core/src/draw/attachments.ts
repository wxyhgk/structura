import { bracketInto } from "../drawing/brackets.ts"
import { bondLengthAt } from "../molecule/measure.ts"
import type { Bracket, Molecule, Point } from "../types.ts"
import type { Attachment, AttachmentShape } from "../markush/types.ts"
import { arcCubics, arcJoin, loopJoin } from "../curves/arc.ts"
import { type Cubic, cubicsBounds, cubicsCommands, cubicsPath, nearestOnCubics, sampleCubics } from "../curves/cubic.ts"
import { ellipseBounds, ellipseCubics, fitEllipse } from "../curves/ellipse.ts"
import { catmullRom } from "../curves/spline.ts"
import { curveNodes } from "../markush/curveFrame.ts"
import { attachmentShape, bondHeading } from "../markush/drawnShape.ts"
import { intoBracketEnd, type Uprights } from "./intoBracket.ts"
import type { AtomLabel } from "./labels.ts"

/** Text drawn beside a label: the brackets and count of "(R1)m". */
export type MarkText = { text: string; x: number; y: number; size: number; anchor: "start" | "end"; italic: boolean; color: string }

/** A box in drawing coordinates. */
export type Extent = { left: number; right: number; top: number; bottom: number }

/**
 * One variable point of attachment as drawn: its `shape`, the stroke as an SVG path (`from`
 * where it leaves the atom, `to` where it meets the ring's middle or the ellipse, or where
 * a custom curve ends or meets its loop), the box round all of it, the box round just the
 * curve (`curve`, for a loop, an arc or a custom curve), the candidate atoms (`targets`),
 * and the repeat marks if any. A custom curve also gives its nodes where they are now and
 * its pieces (`custom`: from the atom through the nodes, or the closed loop), for editing.
 */
export type AttachmentMark = {
  atom: number
  targets: number[]
  shape: AttachmentShape
  from: Point
  to: Point
  path: string
  bounds: Extent
  curve: Extent | null
  texts: MarkText[]
  custom?: { nodes: Point[]; closed: boolean; cubics: Cubic[] }
}

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

/**
 * What drawing attachments needs to know of the brackets: the drawing's `brackets`, for
 * telling which attachments go into one, and where each bracket's uprights stand, by id,
 * once the brackets are drawn. An attachment into a bracket not yet drawn is left out.
 */
export type BracketContext = { brackets?: readonly Bracket[]; uprights?: ReadonlyMap<number, Uprights> }

/**
 * Variable points of attachment as patents draw them, by their shape: a line from the atom
 * (leaving its label) into the middle of one ring; an ellipse round a fused system with a
 * line to it; the bond sweeping round the system as an open curve; a bond crossing a
 * group bracket's upright into it; or a custom curve, smooth through its nodes. "(R1)m"
 * when it repeats. Shared by the canvas and every
 * export (through structureMarks), so they look the same, and recomputed from the atoms, so
 * a curve follows them as they move.
 */
export function attachmentMarks(mol: Molecule, attachments: readonly Attachment[] | undefined, labels: readonly AtomLabel[], context: BracketContext = {}): AttachmentMark[] {
  if (!attachments) return []
  const atoms = new Map(mol.atoms.map((atom) => [atom.id, atom]))
  return attachments.flatMap((attachment): AttachmentMark[] => {
    const from = atoms.get(attachment.atom)
    const targets = attachment.to.flatMap((id) => atoms.get(id) ?? [])
    if (!from || targets.length === 0) return []
    const label = labels.find((item) => item.atomId === from.id)
    const texts = attachment.repeat && label ? repeatTexts(label, attachment.repeat.name) : []
    const shape = attachmentShape(mol, attachment, context.brackets)
    const base = { atom: attachment.atom, targets: targets.map((atom) => atom.id), texts }
    const leaving = (toward: Point) => {
      const t = leaveBox(from, toward, label)
      return { x: from.x + (toward.x - from.x) * t, y: from.y + (toward.y - from.y) * t }
    }
    if (shape === "bracket") {
      const frame = context.uprights?.get(bracketInto(context.brackets, attachment)!.id)
      if (!frame) return []
      const to = intoBracketEnd(from, frame, bondLengthAt(mol, from.id))
      const start = leaving(to)
      return [{ ...base, shape, from: start, to, path: `M ${fixed(start)} L ${fixed(to)}`, bounds: extentOf([start, to]), curve: null }]
    }
    if (shape === "line") {
      const to = { x: targets.reduce((sum, atom) => sum + atom.x, 0) / targets.length, y: targets.reduce((sum, atom) => sum + atom.y, 0) / targets.length }
      const start = leaving(to)
      return [{ ...base, shape, from: start, to, path: `M ${fixed(start)} L ${fixed(to)}`, bounds: extentOf([start, to]), curve: null }]
    }
    if (shape === "custom") {
      const nodes = curveNodes(mol, attachment)!
      if (attachment.curve!.closed) {
        // A loop through the nodes, and the straight line from the atom to its nearest point.
        const loop = catmullRom(nodes, true)
        const end = nearestOnCubics(loop, from)!.point
        const start = leaving(end)
        const curve = cubicsBounds(loop)
        const custom = { nodes, closed: true, cubics: loop }
        return [{ ...base, shape, from: start, to: end, path: `M ${fixed(start)} L ${fixed(end)} ${cubicsPath(loop, true)}`, bounds: extentOf([start, end], curve), curve, custom }]
      }
      // The bond itself, from where it leaves the label through the nodes.
      const start = leaving(nodes[0])
      const cubics = catmullRom([start, ...nodes])
      const custom = { nodes, closed: false, cubics }
      const curve = cubicsBounds(cubics.length > 1 ? cubics.slice(1) : cubics)
      return [{ ...base, shape, from: start, to: nodes[nodes.length - 1], path: cubicsPath(cubics), bounds: extentOf(sampleCubics(cubics, 24)), curve, custom }]
    }
    const ellipse = fitEllipse(targets)
    const curve = ellipseBounds(ellipse)
    const bounds = (start: Point, end: Point) => extentOf([start, end], curve)
    if (shape === "arc") {
      const join = arcJoin(ellipse, from, bondHeading(mol, from.id))
      const start = leaving(join.point)
      const line = Math.hypot(join.point.x - start.x, join.point.y - start.y) > 0.5 ? ` L ${fixed(join.point)}` : ""
      const path = `M ${fixed(start)}${line}${cubicsCommands(arcCubics(ellipse, join))}`
      return [{ ...base, shape, from: start, to: join.point, path, bounds: bounds(start, join.point), curve }]
    }
    // The line leaves the label towards the ellipse's nearest point.
    const start = leaving(loopJoin(ellipse, from))
    const end = loopJoin(ellipse, start)
    const path = `M ${fixed(start)} L ${fixed(end)} ${cubicsPath(ellipseCubics(ellipse, 0, 2 * Math.PI), true)}`
    return [{ ...base, shape, from: start, to: end, path, bounds: bounds(start, end), curve }]
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
