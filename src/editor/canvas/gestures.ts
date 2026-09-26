import { RING_SIZE, SNAP_ATOM } from "@/chem/constants"
import { paintOps, ringShape, runOps } from "@/editor/ops"
import { angleTo, dist, pointInPolygon, signedDelta, snapAngle } from "@/chem/geometry"
import {
  atomById,
  bondLengthAt,
  chainCount,
  chainPoints,
  commitChain,
  connectPoints,
  createBondAt,
  dragIds,
  emptySelection,
  fuseReach,
  fuseRing,
  fusionSide,
  fusionTarget,
  growRing,
  growRingPreview,
  moveAtoms,
  nearestAtom,
  placeAtom,
  placeRing,
  ringOnBond,
  ringPoints,
  rotateAtoms,
  scaleAtoms,
  selectionFromAtoms,
  sprout,
} from "@/chem/molecule"
import { bondEnd, clampScale, frameAt, handleCursor, hitOf, hoverOf, selectionFrame } from "./targeting.ts"
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
  const { mol, tool, bondStyle, ringKind, atomEl, selection, commit, setSelection } = host.props
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
    if (hit?.type === "atom") runOps(mol, [{ op: "remove", atoms: [hit.id] }], commit)
    else if (hit) runOps(mol, [{ op: "remove", bonds: [hit.id] }], commit)
    return
  }
  if (tool === "charge-plus" || tool === "charge-minus") {
    const atom = hit?.type === "atom" ? atomById(mol, hit.id) : undefined
    if (atom) {
      const charge = Math.max(-3, Math.min(3, atom.charge + (tool === "charge-plus" ? 1 : -1)))
      runOps(mol, [{ op: "set_charge", atom: atom.id, charge }], commit, true)
    }
    return
  }
  if (tool === "atom") {
    if (hit?.type === "atom") runOps(mol, [{ op: "set_element", atom: hit.id, el: atomEl }], commit, true)
    else if (!hit) commit(placeAtom(mol, atomEl, world))
    return
  }
  if (tool === "ring") {
    const shape = ringShape(ringKind)
    if (hit?.type === "atom") {
      if (shape) runOps(mol, [{ op: "add_ring", atom: hit.id, ...shape }], commit)
      else commit(growRing(mol, hit.id, ringKind).mol)
      host.setPreview(null)
      return
    }
    const target = fusionTarget(mol, world, ringKind, fuseReach(RING_SIZE[ringKind], bondLengthAt(mol)) / zoom)
    if (target) {
      const side = fusionSide(mol, target, world)
      if (shape) runOps(mol, [{ op: "add_ring", bond: target.id, side, ...shape }], commit)
      else commit(fuseRing(mol, target.id, ringKind, side))
    } else if (!hit) commit(placeRing(mol, world, ringKind))
    host.setPreview(null)
    return
  }
  if (tool === "bond") {
    if (hit?.type === "bond") {
      runOps(mol, paintOps(mol, hit.id, bondStyle), commit)
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
    const distance = Math.hypot(world.x - current.origin.x, world.y - current.origin.y)
    const axis = event.altKey ? angleTo(current.origin, world) : snapAngle(angleTo(current.origin, world))
    const length = bondLengthAt(current.mol, current.fromId ?? undefined)
    host.setPreview({ kind: "chain", points: chainPoints(current.origin, axis, chainCount(distance, length), length) })
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
    host.setDraft(moveAtoms(current.mol, current.ids, world.x - current.origin.x, world.y - current.origin.y))
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

export function pointerUp(host: PointerHost, event: { clientX: number; clientY: number; altKey: boolean }) {
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
    if (!current.moved) {
      host.props.commit(
        current.fromId == null
          ? createBondAt(current.mol, current.origin, current.style)
          : sprout(current.mol, current.fromId, current.style),
      )
      return
    }
    const origin = current.fromId == null ? current.origin : atomById(current.mol, current.fromId) ?? current.origin
    const end = bondEnd(origin, world, current.mol, current.fromId, event.altKey, zoom)
    host.props.commit(connectPoints(current.mol, current.fromId, origin, end, current.style))
    return
  }
  if (current.kind === "chain") {
    const distance = Math.hypot(world.x - current.origin.x, world.y - current.origin.y)
    const axis = event.altKey ? angleTo(current.origin, world) : snapAngle(angleTo(current.origin, world))
    const length = bondLengthAt(current.mol, current.fromId ?? undefined)
    const points = chainPoints(current.origin, axis, chainCount(distance, length), length)
    host.setPreview(null)
    host.props.commit(commitChain(current.mol, points, current.fromId))
    return
  }
  if (current.kind === "rotate") {
    const raw = signedDelta(current.startAngle, angleTo(current.center, world))
    const angle = event.altKey ? raw : snapAngle(raw)
    if (angle !== 0) host.props.commit(rotateAtoms(current.mol, current.ids, current.center, angle), true)
    host.setDraft(null)
    host.setCursor(null)
    host.setRotating(false)
    return
  }
  if (current.kind === "scale") {
    const [sx, sy] = scaleFactors(current, world)
    if (sx !== 1 || sy !== 1) host.props.commit(scaleAtoms(current.mol, current.ids, current.center, sx, sy), true)
    host.setDraft(null)
    host.setCursor(null)
    return
  }
  if (current.kind === "move") {
    const dx = world.x - current.origin.x
    const dy = world.y - current.origin.y
    if (dx !== 0 || dy !== 0) host.props.commit(moveAtoms(current.mol, current.ids, dx, dy), true)
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
