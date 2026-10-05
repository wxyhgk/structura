import { ringPositionsAt } from "@structura/core/markush"
import { SNAP_ATOM, atomById, nearestAtom } from "@structura/core/molecule"
import type { Point } from "@structura/core/types"
import { bondEnd, hitOf } from "../pointer/targeting.ts"
import type { Gesture, GestureKind, PointerHost } from "./types.ts"

type BondGesture = Extract<Gesture, { kind: "bond" }>

/**
 * A bond dragged between an atom and the inside of a ring, either way round, makes a
 * variable point of attachment rather than a bond: –L– hangs off any of that ring's free
 * positions. Returns the atom and those positions, or null for an ordinary bond.
 */
function attachmentTarget(gesture: BondGesture, world: Point, zoom: number): { atom: number; positions: number[] } | null {
  const mol = gesture.mol
  if (gesture.fromId != null) {
    if (hitOf(mol, world, zoom)) return null
    const positions = ringPositionsAt(mol, world, gesture.fromId)
    return positions ? { atom: gesture.fromId, positions } : null
  }
  const landed = nearestAtom(mol, world, SNAP_ATOM / zoom)
  if (!landed) return null
  const positions = ringPositionsAt(mol, gesture.origin, landed.id)
  return positions ? { atom: landed.id, positions } : null
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
    // Between a ring's inside and an atom, letting go makes a variable attachment; show where it could land.
    const attachment = attachmentTarget(gesture, world, zoom)
    if (attachment) {
      const atoms = attachment.positions.map((id) => atomById(gesture.mol, id)!)
      const centre = { x: atoms.reduce((sum, atom) => sum + atom.x, 0) / atoms.length, y: atoms.reduce((sum, atom) => sum + atom.y, 0) / atoms.length }
      host.setPreview({ kind: "attachment", a: atomById(gesture.mol, attachment.atom)!, centre, positions: atoms })
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
    const attachment = attachmentTarget(gesture, world, host.zoom())
    if (attachment) {
      host.props.run([{ op: "set_attachment", atom: attachment.atom, to: attachment.positions }])
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
