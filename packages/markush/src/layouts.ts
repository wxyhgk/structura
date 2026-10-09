import { pointFrom } from "@structura/core/geometry"
import { atomById, bondLengthAt, componentOf, deleteSelection, duplicateAtoms, sproutAngle, subMolecule } from "@structura/core/molecule"
import { applyOps } from "@structura/core/ops"
import type { Drawing, Molecule } from "@structura/core/types"
import type { Attachment } from "@structura/core/markush"
import { odometer } from "./odometer.ts"
import { displacedAt, hasRoom } from "./positions.ts"
import type { Pick } from "./picks.ts"

/** A way of making every variable attachment's bond, with the placeholders it displaces gone. */
export type Layout = { drawing: Drawing; where: Pick[] } | { error: string; where: Pick[] } | { occupied: true }

/** Every set of `size` items from `items`, in order. */
function* subsets<T>(items: readonly T[], size: number, from = 0): Generator<T[]> {
  if (size === 0) return yield []
  for (let at = from; at <= items.length - size; at++) for (const rest of subsets(items, size - 1, at + 1)) yield [items[at], ...rest]
}

/**
 * The ways one attachment can be made: each candidate atom on its own, or for "(R1)m" every
 * set of min to max different candidates, one copy of the piece on each (none for 0).
 */
function placements(attachment: Attachment): number[][] {
  if (!attachment.repeat) return attachment.to.map((id) => [id])
  const all: number[][] = []
  for (let size = attachment.repeat.min; size <= attachment.repeat.max; size++) all.push(...subsets(attachment.to, size))
  return all
}

/**
 * Every way of placing the variable attachments. A candidate that carries a placeholder
 * (R10 on the ring carbon –L– lands on) loses it: the attachment takes that position. A
 * repeated piece is copied once per extra position, and goes altogether when it appears
 * no times.
 */
export function* layouts(drawing: Drawing): Generator<Layout> {
  const attachments = drawing.attachments ?? []
  const names = new Set(Object.keys(drawing.variables ?? {}))
  const label = (mol: Molecule, id: number) => mol.atoms.find((atom) => atom.id === id)?.alias ?? `#${id}`
  const ways = attachments.map(placements)
  for (const choice of odometer(ways.map((list) => list.length))) {
    let laid: Drawing = { molecule: drawing.molecule, arrows: [], nextArrowId: drawing.nextArrowId, variables: drawing.variables }
    const where: Pick[] = []
    let error: string | null = null
    let occupied = false
    for (const [index, attachment] of attachments.entries()) {
      const targets = ways[index][choice[index]]
      const name = label(drawing.molecule, attachment.atom)
      // The copies go in first, while the piece still stands where it was drawn.
      const hubs = [attachment.atom]
      const piece = componentOf(laid.molecule, attachment.atom)
      if (targets.length === 0) laid = { ...laid, molecule: deleteSelection(laid.molecule, { atoms: piece, bonds: [] }) }
      for (let copy = 1; copy < targets.length; copy++) {
        const order = subMolecule(laid.molecule, piece).atoms.map((atom) => atom.id)
        const copied = duplicateAtoms(laid.molecule, order)
        laid = { ...laid, molecule: copied.mol }
        hubs.push(copied.ids[order.indexOf(attachment.atom)])
      }
      const positions: string[] = []
      for (const [at, target] of targets.entries()) {
        const displaced = displacedAt(laid.molecule, target, names)
        positions.push(displaced.length > 0 ? label(laid.molecule, displaced[0]) : `#${target}`)
        const placed = attach(laid, hubs[at], target, displaced)
        if ("occupied" in placed) occupied = true
        else if ("error" in placed) error = placed.error
        else laid = placed.drawing
        if (occupied || error) break
      }
      where.push({ name, position: attachment.repeat ? (positions.length > 0 ? positions.join(", ") : "none") : positions[0] })
      if (occupied || error) break
    }
    yield occupied ? { occupied: true } : error ? { error, where } : { drawing: laid, where }
  }
}

/**
 * Makes one attachment's bond: the placeholder on `target` goes, the attached piece (the
 * hub and everything it carries) is carried over to sit one bond out from `target`, the
 * way a substituent would grow there, then bonded and tidied. Nothing else moves.
 */
function attach(drawing: Drawing, hub: number, target: number, displaced: number[]): { drawing: Drawing } | { error: string } | { occupied: true } {
  const freed = displaced.length > 0 ? applyOps(drawing, [{ op: "remove", atoms: displaced }]) : { ok: true as const, drawing }
  if (!freed.ok) return { error: freed.error }
  const mol = freed.drawing.molecule
  // A position is free only while it has a hydrogen to give up.
  if (!hasRoom(mol, target)) return { occupied: true }
  const piece = componentOf(mol, hub)
  if (piece.includes(target)) return { error: `atom #${hub} is already joined to the ring it attaches to` }
  const from = atomById(mol, hub)!
  const spot = pointFrom(atomById(mol, target)!, sproutAngle(mol, target), bondLengthAt(mol, target))
  const result = applyOps(freed.drawing, [
    { op: "move", atoms: piece, dx: spot.x - from.x, dy: spot.y - from.y },
    { op: "add_bond", a: hub, b: target },
    ...(piece.length > 1 ? [{ op: "clean" as const, atoms: piece.filter((id) => id !== hub), lock: [hub] }] : []),
  ])
  return result.ok ? { drawing: result.drawing } : { error: result.error }
}
