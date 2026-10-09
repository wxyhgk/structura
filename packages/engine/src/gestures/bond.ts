import { ringPositionsAt } from "@structura/markush"
import { SNAP_ATOM, atomById, nearestAtom } from "@structura/core/molecule"
import type { Point } from "@structura/core/types"
import { attachmentOps } from "../markush/attachmentOps.ts"
import { bracketDropAt } from "../pointer/brackets.ts"
import { bondEnd, hitOf } from "../pointer/targeting.ts"
import { ringHint } from "./hints.ts"
import type { Gesture, GestureContext, GestureKind, PointerHost } from "./types.ts"

type BondGesture = Extract<Gesture, { kind: "bond" }>

/**
 * Where a variable attachment would go: from an existing atom (into a group bracket, `into`
 * says where the bond will end), or (atom null) from a new one made at `end`.
 */
type AttachmentTarget = { atom: number; positions: number[]; into?: Point } | { atom: null; end: Point; positions: number[] }

/**
 * A bond dragged between an atom and the inside of a ring, either way round, makes a
 * variable point of attachment rather than a bond: –L– hangs off any of that ring's free
 * positions. Dragged from an atom into a group bracket it is outside of (on no atom and in
 * no ring's middle there), it hangs off any of the bracket's atoms. Dragged from a ring's
 * inside out into empty space, the substituent's atom is made where it ends, in one go.
 * Returns the atom and those positions, or null for an ordinary bond.
 */
function attachmentTarget(gesture: BondGesture, world: Point, zoom: number, context: GestureContext): AttachmentTarget | null {
  const mol = gesture.mol
  if (gesture.fromId != null) {
    const hit = hitOf(mol, world, zoom)
    if (hit?.type === "atom") return null
    const positions = hit ? null : ringPositionsAt(mol, world, gesture.fromId)
    if (positions) return { atom: gesture.fromId, positions }
    // On a bond in a bracket counts as in the bracket: what else could ending there mean.
    const drop = bracketDropAt(mol, context.brackets, context.attachments, world, gesture.fromId)
    return drop ? { atom: gesture.fromId, positions: drop.bracket.atoms, into: drop.end } : null
  }
  const landed = nearestAtom(mol, world, SNAP_ATOM / zoom)
  if (landed) {
    const positions = ringPositionsAt(mol, gesture.origin, landed.id)
    return positions ? { atom: landed.id, positions } : null
  }
  // Out of a ring into the open: not onto a bond, and not into another ring's middle.
  const positions = ringPositionsAt(mol, gesture.origin)
  if (!positions || hitOf(mol, world, zoom) || ringPositionsAt(mol, world)) return null
  return { atom: null, end: world, positions }
}

const originOf = (gesture: BondGesture) => (gesture.fromId == null ? gesture.origin : (atomById(gesture.mol, gesture.fromId) ?? gesture.origin))

/** The bond tool: a click draws a bond from the atom (or a horizontal one); a drag draws to where it ends. */
export const bond: GestureKind<BondGesture> = {
  move(host, gesture, world, event) {
    if (Math.hypot(event.clientX - gesture.clientX, event.clientY - gesture.clientY) > 4) gesture.moved = true
    if (!gesture.moved) return
    const zoom = host.zoom()
    const snapped = nearestAtom(gesture.mol, world, SNAP_ATOM / zoom, gesture.fromId ?? undefined)
    host.assignHover(snapped ? { type: "atom", id: snapped.id } : null)
    // Between a ring's inside (or a bracket's) and an atom, letting go makes a variable attachment; show where it could land.
    const attachment = attachmentTarget(gesture, world, zoom, host.props)
    if (attachment) {
      const from = attachment.atom == null ? attachment.end : atomById(gesture.mol, attachment.atom)!
      const end = attachment.atom != null ? attachment.into : undefined
      host.setPreview({ kind: "attachment", a: from, hint: ringHint(gesture.mol, attachment.positions), ...(end ? { end } : {}) })
      return
    }
    const origin = originOf(gesture)
    host.setPreview({ kind: "bond", a: origin, b: bondEnd(origin, world, gesture.mol, gesture.fromId, event.altKey, zoom), style: gesture.style })
  },
  up(host, gesture, world, event) {
    host.setPreview(null)
    const style = { order: gesture.style.order, stereo: gesture.style.stereo, look: gesture.style.look }
    const from = gesture.fromId ?? undefined
    if (!gesture.moved) {
      host.props.run([{ op: "draw_bond", from, start: gesture.origin, ...style, ringPointer: true }])
      return
    }
    const attachment = attachmentTarget(gesture, world, host.zoom(), host.props)
    if (attachment) {
      // A new atom takes the next id, so the attachment can name it in the same step.
      host.props.run(
        attachment.atom == null
          ? attachmentOps(gesture.mol, gesture.mol.nextAtomId, attachment.positions, { made: attachment.end })
          : attachmentOps(gesture.mol, attachment.atom, attachment.positions),
      )
      return
    }
    const origin = originOf(gesture)
    const end = bondEnd(origin, world, gesture.mol, gesture.fromId, event.altKey, host.zoom())
    host.props.run([{ op: "draw_bond", from, start: origin, end, ...style, ringPointer: true }])
  },
}

/** Pressing with the bond tool: a press on a bond restyles it; anywhere else starts a bond from there. */
export function startBond(host: PointerHost, hit: ReturnType<typeof hitOf>, world: Point, event: { clientX: number; clientY: number }): Gesture {
  return {
    kind: "bond",
    mol: host.props.mol,
    fromId: hit?.type === "atom" ? hit.id : null,
    origin: hit?.type === "atom" ? (atomById(host.props.mol, hit.id) ?? world) : world,
    clientX: event.clientX,
    clientY: event.clientY,
    moved: false,
    style: host.props.bondStyle,
  }
}
