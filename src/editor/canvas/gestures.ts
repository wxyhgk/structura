import { RING_SIZE } from "@structura/core/constants"
import { ringPointerAt, ringPositionsAt } from "@structura/core/markush"
import { ringHint } from "@/editor/markush/hints"
import { paintOps, scaffoldOps } from "@/editor/ops"
import { angleTo, dist, pointInPolygon, signedDelta, snapAngle } from "@structura/core/geometry"
import {
  SNAP_ATOM,
  atomById,
  bondLengthAt,
  chainCount,
  chainPoints,
  emptySelection,
  fuseReach,
  fusionSide,
  fusionTarget,
  growRingPreview,
  moveAtoms,
  nearestAtom,
  ringOnBond,
  ringPoints,
  rotateAtoms,
  scaleAtoms,
  selectionFromAtoms,
} from "@structura/core/molecule"
import { snappedMove } from "./moveSnap.ts"
import { bondEnd, clampScale, dragIds, frameAt, handleCursor, hitOf, hoverOf, selectionFrame } from "./targeting.ts"
import type { Gesture, PointerHost } from "./types.ts"

function scaleFactors(gesture: Extract<Gesture, { kind: "scale" }>, pointer: { x: number; y: number }): [number, number] {
  const { anchor, center, origin } = gesture
  if (anchor === "e" || anchor === "w") {
    const span = origin.x - center.x
    if (Math.abs(span) < 1) return [1, 1]
    return [clampScale((pointer.x - center.x) / span), 1]
  }
  if (anchor === "n" || anchor === "s") {
    const span = origin.y - center.y
    if (Math.abs(span) < 1) return [1, 1]
    return [1, clampScale((pointer.y - center.y) / span)]
  }
  const base = dist(origin, center)
  if (base < 1) return [1, 1]
  const scale = clampScale(dist(pointer, center) / base)
  return [scale, scale]
}

export function pointerDown(host: PointerHost, event: { button: number; clientX: number; clientY: number; shiftKey: boolean; currentTarget: { setPointerCapture: (id: number) => void }; pointerId: number }) {
  if (event.button === 1 || host.space.current) {
    host.gesture.current = {
      kind: "pan",
      clientX: event.clientX,
      clientY: event.clientY,
      pan: { ...host.pan() },
    }
    host.setPanning(true)
    event.currentTarget.setPointerCapture(event.pointerId)
    return
  }
  if (event.button !== 0) return
  const world = host.toWorld(event.clientX, event.clientY)
  const { mol, tool, bondStyle, ringKind, atomEl, selection, run, setSelection } = host.props
  const zoom = host.zoom()
  const hit = hitOf(mol, world, zoom)
  event.currentTarget.setPointerCapture(event.pointerId)

  if (tool === "lasso" || tool === "marquee") {
    const frame = selectionFrame(mol, selection)
    const which = frame ? frameAt(frame, world, zoom) : null
    if (frame && which === "rotate") {
      host.gesture.current = {
        kind: "rotate",
        mol,
        ids: frame.ids,
        center: frame.center,
        startAngle: angleTo(frame.center, world),
      }
      host.assignHover(null)
      host.setCursor(handleCursor(which))
      host.setRotating(true)
      return
    }
    if (frame && which && which !== "rotate") {
      const handle = frame.handles.find((item) => item.kind === which)
      if (handle) {
        host.gesture.current = {
          kind: "scale",
          mol,
          ids: frame.ids,
          center: frame.center,
          anchor: which,
          origin: { x: handle.x, y: handle.y },
        }
        host.assignHover(null)
        host.setCursor(handleCursor(which))
        return
      }
    }
  }

  if (tool === "eraser") {
    if (hit?.type === "atom") run([{ op: "remove", atoms: [hit.id] }])
    else if (hit) run([{ op: "remove", bonds: [hit.id] }])
    return
  }
  if (tool === "charge-plus" || tool === "charge-minus") {
    const atom = hit?.type === "atom" ? atomById(mol, hit.id) : undefined
    if (atom) {
      const charge = Math.max(-3, Math.min(3, atom.charge + (tool === "charge-plus" ? 1 : -1)))
      run([{ op: "set_charge", atom: atom.id, charge }], { keepSelection: true })
    }
    return
  }
  if (tool === "atom") {
    if (hit?.type === "atom") run([{ op: "set_element", atom: hit.id, el: atomEl }], { keepSelection: true })
    else if (!hit) run([{ op: "place_atom", el: atomEl, at: world }])
    return
  }
  if (tool === "scaffold") {
    run(scaffoldOps(host.props.scaffold, hit, world))
    return
  }
  if (tool === "ring") {
    if (hit?.type === "atom") {
      run([{ op: "add_ring", atom: hit.id, kind: ringKind }])
      host.setPreview(null)
      return
    }
    const target = fusionTarget(mol, world, ringKind, fuseReach(RING_SIZE[ringKind], bondLengthAt(mol)) / zoom)
    if (target) {
      const side = fusionSide(mol, target, world)
      run([{ op: "add_ring", bond: target.id, side, kind: ringKind }])
    } else if (!hit) {
      run([{ op: "add_ring", at: world, kind: ringKind }])
    }
    host.setPreview(null)
    return
  }
  if (tool === "bond") {
    if (hit?.type === "bond") {
      run(paintOps(mol, hit.id, bondStyle))
      return
    }
    const origin = hit?.type === "atom" ? atomById(mol, hit.id) ?? world : world
    host.gesture.current = {
      kind: "bond",
      mol,
      fromId: hit?.type === "atom" ? hit.id : null,
      origin,
      clientX: event.clientX,
      clientY: event.clientY,
      moved: false,
      style: bondStyle,
    }
    return
  }
  if (tool === "chain") {
    const fromId = hit?.type === "atom" ? hit.id : null
    const origin = fromId != null ? atomById(mol, fromId) ?? world : world
    host.gesture.current = { kind: "chain", mol, fromId, origin }
    host.setPreview({ kind: "chain", points: chainPoints(origin, 0, 1, bondLengthAt(mol, fromId ?? undefined)) })
    return
  }

  if (hit) {
    let next = selection
    if (event.shiftKey) {
      if (hit.type === "atom") {
        const atoms = selection.atoms.includes(hit.id)
          ? selection.atoms.filter((id) => id !== hit.id)
          : [...selection.atoms, hit.id]
        next = selectionFromAtoms(mol, atoms)
      } else {
        const bonds = selection.bonds.includes(hit.id)
          ? selection.bonds.filter((id) => id !== hit.id)
          : [...selection.bonds, hit.id]
        next = { ...selection, bonds }
      }
      setSelection(next)
      return
    }
    if (hit.type === "atom" && !selection.atoms.includes(hit.id)) {
      next = { atoms: [hit.id], bonds: [] }
      setSelection(next)
    } else if (hit.type === "bond" && !selection.bonds.includes(hit.id)) {
      next = { atoms: [], bonds: [hit.id] }
      setSelection(next)
    }
    host.gesture.current = { kind: "move", mol, ids: dragIds(mol, next, hit), origin: world }
    return
  }

  if (!event.shiftKey) setSelection(emptySelection())
  if (tool === "marquee") {
    host.gesture.current = {
      kind: "marquee",
      origin: world,
      base: event.shiftKey ? selection : emptySelection(),
      additive: event.shiftKey,
    }
    host.setPreview({ kind: "marquee", a: world, b: world })
    return
  }
  host.gesture.current = {
    kind: "lasso",
    points: [world],
    base: event.shiftKey ? selection : emptySelection(),
    additive: event.shiftKey,
  }
  host.setPreview({ kind: "lasso", points: [world] })
}

export function pointerMove(host: PointerHost, event: { clientX: number; clientY: number; altKey: boolean }) {
  const world = host.toWorld(event.clientX, event.clientY)
  const current = host.gesture.current
  const zoom = host.zoom()
  if (current.kind === "idle") {
    host.assignHover(hoverOf(host.props.mol, world, zoom))
    const selecting = host.props.tool === "lasso" || host.props.tool === "marquee"
    const frame = selecting ? selectionFrame(host.props.mol, host.props.selection) : null
    const which = frame ? frameAt(frame, world, zoom) : null
    host.setCursor(which ? handleCursor(which) : null)
  }
  if (current.kind === "idle" && host.props.tool === "ring") {
    const aimed = hitOf(host.props.mol, world, zoom)
    if (aimed?.type === "atom") {
      const atom = atomById(host.props.mol, aimed.id)
      if (atom) {
        const preview = growRingPreview(host.props.mol, atom.id, host.props.ringKind)
        host.setPreview({
          kind: "ring",
          points: preview.points,
          doubles: host.props.ringKind === "benzene",
          anchor: preview.anchor,
        })
        return
      }
    }
    const target =
      aimed?.type === "atom"
        ? null
        : fusionTarget(host.props.mol, world, host.props.ringKind, fuseReach(RING_SIZE[host.props.ringKind], bondLengthAt(host.props.mol)) / zoom)
    if (target) {
      const a = atomById(host.props.mol, target.a)
      const b = atomById(host.props.mol, target.b)
      if (a && b) {
        host.setPreview({
          kind: "ring",
          points: ringOnBond(a, b, RING_SIZE[host.props.ringKind], fusionSide(host.props.mol, target, world)),
          doubles: host.props.ringKind === "benzene",
        })
        return
      }
    }
    if (aimed) {
      host.setPreview(null)
      return
    }
    host.setPreview({
      kind: "ring",
      points: ringPoints(world, RING_SIZE[host.props.ringKind], bondLengthAt(host.props.mol)),
      doubles: host.props.ringKind === "benzene",
    })
    return
  }
  if (current.kind === "idle") return
  if (current.kind === "pan") {
    host.setView(zoom, {
      x: current.pan.x + (event.clientX - current.clientX),
      y: current.pan.y + (event.clientY - current.clientY),
    })
    return
  }
  if (current.kind === "bond") {
    const moved = Math.hypot(event.clientX - current.clientX, event.clientY - current.clientY) > 4
    if (moved) current.moved = true
    if (current.moved) {
      const origin = current.fromId == null ? current.origin : atomById(current.mol, current.fromId) ?? current.origin
      const snapped = nearestAtom(current.mol, world, SNAP_ATOM / zoom, current.fromId ?? undefined)
      host.assignHover(snapped ? { type: "atom", id: snapped.id } : null)
      // Between a ring's inside and an atom, letting go makes a variable attachment; show where it could land.
      const attachment = attachmentTarget(current, world, zoom)
      if (attachment) {
        const atoms = attachment.positions.map((id) => atomById(current.mol, id)!)
        const centre = { x: atoms.reduce((sum, atom) => sum + atom.x, 0) / atoms.length, y: atoms.reduce((sum, atom) => sum + atom.y, 0) / atoms.length }
        host.setPreview({ kind: "attachment", a: atomById(current.mol, attachment.atom)!, centre, positions: atoms })
        return
      }
      host.setPreview({
        kind: "bond",
        a: origin,
        b: bondEnd(origin, world, current.mol, current.fromId, event.altKey, zoom),
        style: current.style,
      })
    }
    return
  }
  if (current.kind === "chain") {
    const { points, positions } = chainTo(current, world, event.altKey)
    host.setPreview({ kind: "chain", points })
    host.setRingHint(positions ? ringHint(positions.map((id) => atomById(current.mol, id)!)) : null)
    return
  }
  if (current.kind === "rotate") {
    const raw = signedDelta(current.startAngle, angleTo(current.center, world))
    const angle = event.altKey ? raw : snapAngle(raw)
    host.setDraft(rotateAtoms(current.mol, current.ids, current.center, angle))
    return
  }
  if (current.kind === "scale") {
    host.setDraft(scaleAtoms(current.mol, current.ids, current.center, ...scaleFactors(current, world)))
    return
  }
  if (current.kind === "move") {
    // Near an atom that stays, the drag snaps onto it: letting go joins them.
    const { dx, dy, target } = snappedMove(current.mol, current.ids, world.x - current.origin.x, world.y - current.origin.y, zoom)
    host.setDraft(moveAtoms(current.mol, current.ids, dx, dy))
    host.assignHover(target != null ? { type: "atom", id: target } : null)
    // A line's end dragged into a ring will attach there.
    const end = current.ids.length === 1 ? atomById(current.mol, current.ids[0]) : undefined
    const positions = end ? ringPointerAt(current.mol, end.id, { x: end.x + dx, y: end.y + dy }) : null
    host.setRingHint(positions ? ringHint(positions.map((id) => atomById(current.mol, id)!)) : null)
    return
  }
  if (current.kind === "marquee") {
    host.setPreview({ kind: "marquee", a: current.origin, b: world })
    return
  }
  if (current.kind === "lasso") {
    current.points = [...current.points, world]
    host.setPreview({ kind: "lasso", points: current.points })
  }
}

/**
 * The zigzag the chain tool draws toward the pointer. Its direction snaps to 30° steps
 * (not with Alt), except when the pointer is inside a ring: then it aims straight there and
 * ends exactly at the pointer, so the chain attaches at any of that ring's free positions,
 * which are returned too.
 */
function chainTo(gesture: Extract<Gesture, { kind: "chain" }>, world: { x: number; y: number }, free: boolean) {
  const mol = gesture.mol
  const positions = ringPositionsAt(mol, world, gesture.fromId ?? undefined)
  const distance = Math.hypot(world.x - gesture.origin.x, world.y - gesture.origin.y)
  const axis = free || positions ? angleTo(gesture.origin, world) : snapAngle(angleTo(gesture.origin, world))
  const length = bondLengthAt(mol, gesture.fromId ?? undefined)
  const points = chainPoints(gesture.origin, axis, chainCount(distance, length), length)
  if (positions) points[points.length - 1] = world
  return { points, positions }
}

/**
 * A bond dragged between an atom and the inside of a ring, either way round, makes a
 * variable point of attachment rather than a bond: –L– hangs off any of that ring's free
 * positions. Returns the atom and those positions, or null for an ordinary bond.
 */
function attachmentTarget(gesture: Extract<Gesture, { kind: "bond" }>, world: { x: number; y: number }, zoom: number): { atom: number; positions: number[] } | null {
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

export function pointerUp(host: PointerHost, event: { clientX: number; clientY: number; altKey: boolean }) {
  const { run } = host.props
  host.setRingHint(null)
  const current = host.gesture.current
  host.gesture.current = { kind: "idle" }
  if (current.kind === "pan") {
    if (!host.space.current) host.setPanning(false)
    return
  }
  const world = host.toWorld(event.clientX, event.clientY)
  const zoom = host.zoom()
  if (current.kind === "bond") {
    host.setPreview(null)
    const style = { order: current.style.order, stereo: current.style.stereo, look: current.style.look }
    const from = current.fromId ?? undefined
    if (!current.moved) {
      run([{ op: "draw_bond", from, start: current.origin, ...style, ringPointer: true }])
      return
    }
    const attachment = attachmentTarget(current, world, zoom)
    if (attachment) {
      run([{ op: "set_attachment", atom: attachment.atom, to: attachment.positions }])
      return
    }
    const origin = current.fromId == null ? current.origin : atomById(current.mol, current.fromId) ?? current.origin
    const end = bondEnd(origin, world, current.mol, current.fromId, event.altKey, zoom)
    run([{ op: "draw_bond", from, start: origin, end, ...style, ringPointer: true }])
    return
  }
  if (current.kind === "chain") {
    const { points } = chainTo(current, world, event.altKey)
    host.setPreview(null)
    run([{ op: "draw_chain", from: current.fromId ?? undefined, points, ringPointer: true }])
    return
  }
  if (current.kind === "rotate") {
    const raw = signedDelta(current.startAngle, angleTo(current.center, world))
    const angle = event.altKey ? raw : snapAngle(raw)
    if (angle !== 0) run([{ op: "rotate", atoms: current.ids, angle, center: current.center }], { keepSelection: true })
    host.setDraft(null)
    host.setCursor(null)
    host.setRotating(false)
    return
  }
  if (current.kind === "scale") {
    const [sx, sy] = scaleFactors(current, world)
    if (sx !== 1 || sy !== 1) run([{ op: "scale", atoms: current.ids, sx, sy, center: current.center }], { keepSelection: true })
    host.setDraft(null)
    host.setCursor(null)
    return
  }
  if (current.kind === "move") {
    const { dx, dy } = snappedMove(current.mol, current.ids, world.x - current.origin.x, world.y - current.origin.y, host.zoom())
    if (dx !== 0 || dy !== 0) run([{ op: "move", atoms: current.ids, dx, dy, ringPointer: true, join: true }], { keepSelection: true })
    host.setDraft(null)
    return
  }
  if (current.kind === "marquee") {
    const atoms = host.props.mol.atoms
      .filter((atom) => {
        const minX = Math.min(current.origin.x, world.x)
        const maxX = Math.max(current.origin.x, world.x)
        const minY = Math.min(current.origin.y, world.y)
        const maxY = Math.max(current.origin.y, world.y)
        return atom.x >= minX && atom.x <= maxX && atom.y >= minY && atom.y <= maxY
      })
      .map((atom) => atom.id)
    const picked = selectionFromAtoms(host.props.mol, atoms)
    host.props.setSelection(
      current.additive
        ? {
            atoms: [...new Set([...current.base.atoms, ...picked.atoms])],
            bonds: [...new Set([...current.base.bonds, ...picked.bonds])],
          }
        : picked,
    )
    host.setPreview(null)
    return
  }
  if (current.kind === "lasso") {
    if (current.points.length < 3) {
      host.setPreview(null)
      return
    }
    const atoms = host.props.mol.atoms.filter((atom) => pointInPolygon(atom, current.points)).map((atom) => atom.id)
    const picked = selectionFromAtoms(host.props.mol, atoms)
    host.props.setSelection(
      current.additive
        ? {
            atoms: [...new Set([...current.base.atoms, ...picked.atoms])],
            bonds: [...new Set([...current.base.bonds, ...picked.bonds])],
          }
        : picked,
    )
    host.setPreview(null)
  }
}
