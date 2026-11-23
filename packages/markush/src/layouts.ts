import { pointFrom } from "@structura/core/geometry"
import { atomById, bondLengthAt, componentOf, deleteSelection, duplicateAtoms, sproutAngle, subMolecule } from "@structura/core/molecule"
import { applyOps } from "@structura/core/ops"
import type { Drawing, Molecule } from "@structura/core/types"
import type { Attachment } from "@structura/core/markush"
import { displacedAt, hasRoom } from "./positions.ts"
import type { Pick } from "./picks.ts"

/** A way of making every variable attachment's bond, with the placeholders it displaces gone. */
export type Layout = { drawing: Drawing; where: Pick[] } | { error: string; where: Pick[] } | { occupied: true }

/** n choose k, exactly (n and k are small: the candidates of one attachment). */
export function choose(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n
  let result = 1n
  for (let step = 1; step <= Math.min(k, n - k); step++) result = (result * BigInt(n - step + 1)) / BigInt(step)
  return result
}

/** The `rank`-th (0-based) set of `size` items from `items`, in the order of choosing them front to back. */
function nthSubset<T>(items: readonly T[], size: number, rank: bigint): T[] {
  const chosen: T[] = []
  let at = 0
  for (let left = size; left > 0; left--) {
    for (; ; at++) {
      const ways = choose(items.length - at - 1, left - 1)
      if (rank < ways) break
      rank -= ways
    }
    chosen.push(items[at++])
  }
  return chosen
}

/** The ways one attachment can be made, counted and reachable by rank without listing them. */
export type Placements = { size: bigint; at: (rank: bigint) => number[] }

/**
 * The ways one attachment can be made: each candidate atom on its own, or for "(R1)m" every
 * set of min to max different candidates, one copy of the piece on each (none for 0); the
 * smaller sets first, each size in the order of its atoms.
 */
export function placements(attachment: Attachment): Placements {
  if (!attachment.repeat) return { size: BigInt(attachment.to.length), at: (rank) => [attachment.to[Number(rank)]] }
  const { min, max } = attachment.repeat
  const sizes: bigint[] = []
  for (let count = min; count <= max; count++) sizes.push(choose(attachment.to.length, count))
  return {
    size: sizes.reduce((sum, size) => sum + size, 0n),
    at(rank) {
      for (const [index, size] of sizes.entries()) {
        if (rank < size) return nthSubset(attachment.to, min + index, rank)
        rank -= size
      }
      throw new RangeError("no such placement")
    },
  }
}

/** Every way of placing the variable attachments, one per index: the last attachment turns fastest, as in an odometer. */
export type LayoutSpace = {
  size: bigint
  at: (index: bigint) => Layout
  /** Just the candidate atoms each attachment goes to in layout `index`, without making it. */
  targets: (index: bigint) => number[][]
}

/**
 * Every way of placing the variable attachments, reached by index (see LayoutSpace) so
 * that no more than the ones asked for are ever made. A candidate that carries a
 * placeholder (R10 on the ring carbon –L– lands on) loses it: the attachment takes that
 * position. A repeated piece is copied once per extra position, and goes altogether when
 * it appears no times. `usable` leaves out the layouts that put a piece on any candidate not in it
 * (those with no room: they would only be passed over).
 */
export function layoutSpace(drawing: Drawing, usable?: ReadonlySet<number>): LayoutSpace {
  // With `usable` candidates only, the layouts that avoid every other candidate, in the order they have among all.
  const attachments = (drawing.attachments ?? []).map((attachment) => (usable ? { ...attachment, to: attachment.to.filter((id) => usable.has(id)) } : attachment))
  const names = new Set(Object.keys(drawing.variables ?? {}))
  const label = (mol: Molecule, id: number) => mol.atoms.find((atom) => atom.id === id)?.alias ?? `#${id}`
  const ways = attachments.map(placements)
  // The atoms the attachments carry: a piece's own placeholder (R1 on its own) is never one that a later attachment displaces.
  const pieces = new Set(attachments.flatMap((attachment) => componentOf(drawing.molecule, attachment.atom)))
  const size = ways.reduce((product, list) => product * list.size, 1n)
  /** Which of its placements each attachment makes: mixed radix, the last attachment the lowest digit. */
  const digits = (which: bigint): bigint[] => {
    if (which < 0n || which >= size) throw new RangeError("no such layout")
    const choice: bigint[] = []
    let rest = which
    for (let digit = ways.length - 1; digit >= 0; digit--) {
      choice[digit] = rest % ways[digit].size
      rest /= ways[digit].size
    }
    return choice
  }
  const at = (which: bigint): Layout => {
    const choice = digits(which)
    const carried = new Set(pieces)
    let laid: Drawing = { molecule: drawing.molecule, arrows: [], nextArrowId: drawing.nextArrowId, variables: drawing.variables }
    const where: Pick[] = []
    let error: string | null = null
    let occupied = false
    for (const [index, attachment] of attachments.entries()) {
      const targets = ways[index].at(choice[index])
      const name = label(drawing.molecule, attachment.atom)
      // The copies go in first, while the piece still stands where it was drawn.
      const hubs = [attachment.atom]
      const piece = componentOf(laid.molecule, attachment.atom)
      if (targets.length === 0) laid = { ...laid, molecule: deleteSelection(laid.molecule, { atoms: piece, bonds: [] }) }
      for (let copy = 1; copy < targets.length; copy++) {
        const order = subMolecule(laid.molecule, piece).atoms.map((atom) => atom.id)
        const copied = duplicateAtoms(laid.molecule, order)
        laid = { ...laid, molecule: copied.mol }
        for (const id of copied.ids) carried.add(id)
        hubs.push(copied.ids[order.indexOf(attachment.atom)])
      }
      const positions: string[] = []
      for (const [at, target] of targets.entries()) {
        const displaced = displacedAt(laid.molecule, target, names).filter((id) => !carried.has(id))
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
    return occupied ? { occupied: true } : error ? { error, where } : { drawing: laid, where }
  }
  return { size, at, targets: (which) => digits(which).map((choice, index) => ways[index].at(choice)) }
}

/** Every layout, in order (see layoutSpace). */
export function* layouts(drawing: Drawing): Generator<Layout> {
  const space = layoutSpace(drawing)
  for (let index = 0n; index < space.size; index++) yield space.at(index)
}

/**
 * Makes one attachment's bond: the placeholder on `target` goes, the attached piece (the
 * hub and everything it carries) is carried over to sit one bond out from `target`, the
 * way a substituent would grow there, then bonded and tidied. Nothing else moves. Without
 * `geometry` only the bond is made (the piece stays where it is): the same molecule graph,
 * for counting what a layout allows.
 */
export function attach(drawing: Drawing, hub: number, target: number, displaced: number[], geometry = true): { drawing: Drawing } | { error: string } | { occupied: true } {
  const freed = displaced.length > 0 ? applyOps(drawing, [{ op: "remove", atoms: displaced }]) : { ok: true as const, drawing }
  if (!freed.ok) return { error: freed.error }
  const mol = freed.drawing.molecule
  // A position is free only while it has a hydrogen to give up.
  if (!hasRoom(mol, target)) return { occupied: true }
  const piece = componentOf(mol, hub)
  if (piece.includes(target)) return { error: `atom #${hub} is already joined to the ring it attaches to` }
  if (!geometry) {
    const bonded = applyOps(freed.drawing, [{ op: "add_bond", a: hub, b: target }])
    return bonded.ok ? { drawing: bonded.drawing } : { error: bonded.error }
  }
  const from = atomById(mol, hub)!
  const spot = pointFrom(atomById(mol, target)!, sproutAngle(mol, target), bondLengthAt(mol, target))
  const result = applyOps(freed.drawing, [
    { op: "move", atoms: piece, dx: spot.x - from.x, dy: spot.y - from.y },
    { op: "add_bond", a: hub, b: target },
    ...(piece.length > 1 ? [{ op: "clean" as const, atoms: piece.filter((id) => id !== hub), lock: [hub] }] : []),
  ])
  return result.ok ? { drawing: result.drawing } : { error: result.error }
}
