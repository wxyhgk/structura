import { curveFrame, curveMinNodes, curveNodes, intoFrame, type Attachment } from "@structura/markush"
import type { Op } from "@structura/core/ops"
import type { Drawing, Molecule, Point } from "@structura/core/types"
import type { Run } from "../ops/builders.ts"

// Editing a custom attachment curve's nodes: which curve (and node) is picked, the op a
// change makes, and the keys that act on the picked node.

/** The custom curve being edited, by the atom its attachment hangs from, and the node picked on it (null for none). */
export type CurveFocus = { atom: number; node: number | null }

/** The op that redraws `atom`'s attachment through `nodes` (drawing coordinates). */
export function curveOp(atom: number, nodes: readonly Point[], closed: boolean): Op {
  return { op: "set_attachment_curve", atom, nodes: nodes.map((p) => [p.x, p.y]), closed }
}

/** The attachments with `atom`'s curve going through `nodes` instead, for showing a drag before it is let go. */
export function withNodes(mol: Molecule, attachments: readonly Attachment[], atom: number, nodes: readonly Point[], closed: boolean): Attachment[] {
  return attachments.map((attachment) => {
    if (attachment.atom !== atom) return attachment
    const frame = curveFrame(mol, attachment.to)
    return frame ? { ...attachment, shape: "custom" as const, curve: { nodes: nodes.map((p) => intoFrame(frame, p)), closed } } : attachment
  })
}

/** `nodes` without the one at `index`, or null when that would leave too few. */
export function withoutNode(nodes: readonly Point[], index: number, closed: boolean): Point[] | null {
  if (nodes.length <= curveMinNodes(closed) || index < 0 || index >= nodes.length) return null
  return nodes.filter((_, i) => i !== index)
}

/** The custom attachment of `atom` in the drawing and its nodes where they are now, or null. */
export function focusedCurve(drawing: Drawing, atom: number): { attachment: Attachment; nodes: Point[] } | null {
  const attachment = drawing.attachments?.find((item) => item.atom === atom)
  if (!attachment || attachment.shape !== "custom") return null
  const nodes = curveNodes(drawing.molecule, attachment)
  return nodes ? { attachment, nodes } : null
}

/**
 * A key while a curve is being edited: Escape stops editing it; Delete or Backspace takes
 * out the picked node (never below two nodes, three on a closed curve). Returns whether the
 * key was used: with a node picked, Delete is used even when the node cannot go, so it
 * never reaches anything else.
 */
export function curveKey(key: string, editing: { drawing: Drawing; focus: CurveFocus | null; setFocus: (focus: CurveFocus | null) => void; run: Run }): boolean {
  const { focus, setFocus } = editing
  if (!focus) return false
  if (key === "Escape") {
    setFocus(null)
    return true
  }
  if (key !== "Delete" && key !== "Backspace") return false
  const curve = focusedCurve(editing.drawing, focus.atom)
  if (!curve || focus.node == null) return false
  const closed = curve.attachment.curve!.closed
  const fewer = withoutNode(curve.nodes, focus.node, closed)
  if (fewer) editing.run([curveOp(focus.atom, fewer, closed)], { keepSelection: true })
  setFocus({ atom: focus.atom, node: null })
  return true
}
