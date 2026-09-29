import type { Molecule } from "../../types.ts"
import { smallestRings } from "../cycles.ts"
import { bondsOf } from "../lookup.ts"
import type { Setup } from "./setup.ts"

/** Distance targets between atom pairs, in bond lengths. Angles are held by 1-3 distances. */
export type Springs = { a: number[]; b: number[]; length: number[]; weight: number[] }

const BOND = 4
const ANGLE = 1
const RING = 0.6

/** A straight-through atom: on a triple bond, or between two double bonds. */
function isLinear(mol: Molecule, id: number): boolean {
  let doubles = 0
  for (const bond of bondsOf(mol, id)) {
    if (bond.order === 3) return true
    if (bond.order === 2) doubles++
  }
  return doubles >= 2
}

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`)

/** Every atom index that could feel a spring: the moving atoms and their neighbours. */
function touched(setup: Setup, around: (at: number) => number[]): Set<number> {
  const near = new Set<number>()
  for (const { members } of setup.bodies) {
    for (const at of members) {
      near.add(at)
      for (const other of around(at)) near.add(other)
    }
  }
  return near
}

/**
 * Where the neighbours of a centre want to sit, as the angle of each gap going round.
 * Pairs that close one of the centre's rings keep that ring's inside angle and stay next
 * to each other; the rest share what is left of the full turn.
 */
function gapsAround(
  bonded: number[],
  inside: Map<string, number>,
  angleOf: (at: number) => number,
  linear: boolean,
): { order: number[]; gaps: number[] } {
  if (bonded.length === 2 && !inside.has(pairKey(bonded[0], bonded[1]))) {
    const turn = linear ? Math.PI : (2 * Math.PI) / 3
    return { order: bonded, gaps: [turn, 2 * Math.PI - turn] }
  }
  // Ring pairs chain neighbours into blocks that must stay together, in their ring order.
  const linked = new Map<number, number[]>(bonded.map((at) => [at, []]))
  for (const [i, a] of bonded.entries()) {
    for (const b of bonded.slice(i + 1)) {
      if (!inside.has(pairKey(a, b))) continue
      linked.get(a)!.push(b)
      linked.get(b)!.push(a)
    }
  }
  const seen = new Set<number>()
  /** `closed` when the ring pairs go all the way round: the last gap is a ring's too. */
  const blocks: Array<{ atoms: number[]; closed: boolean }> = []
  const byAngle = [...bonded].sort((a, b) => angleOf(a) - angleOf(b) || a - b)
  for (const first of byAngle) {
    if (seen.has(first)) continue
    const piece = [first]
    seen.add(first)
    for (let index = 0; index < piece.length; index++) {
      for (const other of linked.get(piece[index])!) {
        if (seen.has(other)) continue
        seen.add(other)
        piece.push(other)
      }
    }
    const end = piece.find((at) => linked.get(at)!.length <= 1)
    const isPath = end != null && piece.every((at) => linked.get(at)!.length <= 2)
    if (!isPath) {
      blocks.push({ atoms: piece.sort((a, b) => angleOf(a) - angleOf(b) || a - b), closed: true })
      continue
    }
    const path = [end]
    while (path.length < piece.length) path.push(linked.get(path[path.length - 1])!.find((at) => !path.includes(at))!)
    // Keep the block turning the way it already turns.
    if (path.length > 1 && Math.sin(angleOf(path[1]) - angleOf(path[0])) < 0) path.reverse()
    blocks.push({ atoms: path, closed: false })
  }
  const order = blocks.flatMap((block) => block.atoms)
  // Inside a block each gap is a ring's; between blocks it is open, left for the rest.
  const gaps = blocks.flatMap(({ atoms, closed }) =>
    atoms.map((at, index) => {
      const last = index === atoms.length - 1
      if (last && !(closed && blocks.length === 1)) return -1
      return inside.get(pairKey(at, atoms[last ? 0 : index + 1])) ?? -1
    }),
  )
  const taken = gaps.reduce((sum, gap) => sum + Math.max(gap, 0), 0)
  const open = gaps.filter((gap) => gap < 0).length
  const share = open > 0 ? Math.max(2 * Math.PI - taken, 0.3 * open) / open : 0
  const scale = open === 0 && taken > 0 ? (2 * Math.PI) / taken : 1
  return { order, gaps: gaps.map((gap) => (gap < 0 ? share : gap * scale)) }
}

/**
 * Bonds to the target length, each centre's neighbours at the angles they want (120° on a
 * chain, 180° through an sp atom, the regular polygon's angle inside a ring and the rest
 * spread outside it), and each ring's atoms where a regular polygon puts them.
 */
export function buildSprings(mol: Molecule, setup: Setup): { springs: Springs; close: Set<number> } {
  const { index, body, visible } = setup
  const count = setup.ids.length
  const springs: Springs = { a: [], b: [], length: [], weight: [] }
  const close = new Set<number>()
  const add = (a: number, b: number, length: number, weight: number) => {
    if (a === b) return
    close.add(Math.min(a, b) * count + Math.max(a, b))
    if (body[a] === body[b]) return
    springs.a.push(a)
    springs.b.push(b)
    springs.length.push(length)
    springs.weight.push(weight)
  }
  const around = (at: number) => {
    const found: number[] = []
    for (const bond of bondsOf(mol, setup.ids[at])) {
      const other = index.get(bond.a === setup.ids[at] ? bond.b : bond.a)
      if (other != null && other !== at && !found.includes(other)) found.push(other)
    }
    return found
  }
  const near = touched(setup, around)

  for (const at of near) for (const other of around(at)) if (at < other || !near.has(other)) add(at, other, 1, BOND)

  const component = [...near].map((at) => setup.ids[at])
  const rings = smallestRings(mol, reach(mol, component))
  const inside = new Map<number, Map<string, number>>()
  for (const ring of rings) {
    const n = ring.length
    const angle = (Math.PI * (n - 2)) / n
    const members = ring.map((id) => index.get(id)!)
    for (const [position, at] of members.entries()) {
      const before = members[(position + n - 1) % n]
      const after = members[(position + 1) % n]
      const own = inside.get(at) ?? new Map<string, number>()
      const key = pairKey(before, after)
      own.set(key, Math.min(own.get(key) ?? Infinity, angle))
      inside.set(at, own)
      for (let step = 2; step <= n / 2; step++) {
        const other = members[(position + step) % n]
        // Straight across an even ring, each pair is met from both ends; count it once.
        if (step === n / 2 && position >= step) continue
        if (!near.has(at) && !near.has(other)) continue
        add(at, other, Math.sin((Math.PI * step) / n) / Math.sin(Math.PI / n), RING)
      }
    }
  }

  for (const centre of near) {
    if (!visible[centre]) continue
    const bonded = around(centre).filter((at) => visible[at])
    if (bonded.length < 2) continue
    const cx = setup.start[centre * 2]
    const cy = setup.start[centre * 2 + 1]
    const angleOf = (at: number) => Math.atan2(setup.start[at * 2 + 1] - cy, setup.start[at * 2] - cx)
    const linear = isLinear(mol, setup.ids[centre])
    const { order, gaps } = gapsAround(bonded, inside.get(centre) ?? new Map(), angleOf, linear)
    for (let i = 0; i < order.length; i++) {
      let sweep = 0
      for (let k = i + 1; k < order.length; k++) {
        sweep += gaps[k - 1]
        const angle = Math.min(sweep, 2 * Math.PI - sweep)
        add(order[i], order[k], 2 * Math.sin(angle / 2), k === i + 1 || (i === 0 && k === order.length - 1) ? ANGLE : ANGLE / 2)
      }
    }
  }
  return { springs, close }
}

/** The atoms bonded, however far, to any of `ids`. */
function reach(mol: Molecule, ids: number[]): Set<number> {
  const seen = new Set(ids)
  const queue = [...ids]
  for (let index = 0; index < queue.length; index++) {
    for (const bond of bondsOf(mol, queue[index])) {
      const other = bond.a === queue[index] ? bond.b : bond.a
      if (seen.has(other)) continue
      seen.add(other)
      queue.push(other)
    }
  }
  return seen
}
