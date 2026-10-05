import { ringPositionsAt } from "@structura/core/markush"
import { SNAP_ATOM, atomById, nearestAtom } from "@structura/core/molecule"
import type { Op } from "@structura/core/ops"
import type { Molecule, Point } from "@structura/core/types"
import { bondEnd, hitOf } from "../pointer/targeting.ts"
import type { Gesture, GestureKind, PointerHost } from "./types.ts"

type BondGesture = Extract<Gesture, { kind: "bond" }>

/** Where a variable attachment would go: from an existing atom, or (atom null) from a new one made at `end`. */
type AttachmentTarget = { atom: number; positions: number[] } | { atom: null; end: Point; positions: number[] }

/**
 * A bond dragged between an atom and the inside of a ring, either way round, makes a
 * variable point of attachment rather than a bond: –L– hangs off any of that ring's free
 * positions. Dragged from a ring's inside out into empty space, the substituent's atom is
 * made where it ends, in one go. Returns the atom and those positions, or null for an
 * ordinary bond.
 */
function attachmentTarget(gesture: BondGesture, world: Point, zoom: number): AttachmentTarget | null {
  const mol = gesture.mol
  if (gesture.fromId != null) {
    if (hitOf(mol, world, zoom)) return null
    const positions = ringPositionsAt(mol, world, gesture.fromId)
    return positions ? { atom: gesture.fromId, positions } : null
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

/** The first R number the drawing does not use yet: R1, or R2 when R1 is taken, and so on. */
function nextRName(mol: Molecule): string {
  const used = new Set(mol.atoms.flatMap((atom) => (atom.alias && /^R\d+$/.test(atom.alias) ? [atom.alias] : [])))
  let n = 1
  while (used.has(`R${n}`)) n++
  return `R${n}`
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
      const from = attachment.atom == null ? attachment.end : atomById(gesture.mol, attachment.atom)!
      host.setPreview({ kind: "attachment", a: from, centre, positions: atoms })
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
      // A new atom takes the next id, so the attachment can name it in the same step.
      const ops: Op[] =
        attachment.atom == null
          ? [
              { op: "place_atom", el: "C", at: attachment.end },
              // What hangs off a ring "at any position" is nearly always an R group: it is labelled one at once.
              { op: "label", atom: gesture.mol.nextAtomId, text: nextRName(gesture.mol) },
              { op: "set_attachment", atom: gesture.mol.nextAtomId, to: attachment.positions },
            ]
          : [{ op: "set_attachment", atom: attachment.atom, to: attachment.positions }]
      host.props.run(ops)
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
