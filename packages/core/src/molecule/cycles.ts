import type { Molecule } from "../types.ts"
import { bondsOf } from "./lookup.ts"

type Graph = Map<number, number[]>

/** The bonded graph over `atoms` (or the whole molecule), neighbours sorted by id so every walk is repeatable. */
function graphOf(mol: Molecule, atoms?: Iterable<number>): Graph {
  const keep = atoms ? new Set(atoms) : null
  const graph: Graph = new Map()
  const ids = mol.atoms.map((atom) => atom.id).filter((id) => !keep || keep.has(id))
  for (const id of [...new Set(ids)].sort((a, b) => a - b)) {
    const around = new Set<number>()
    for (const bond of bondsOf(mol, id)) {
      const other = bond.a === id ? bond.b : bond.a
      if (other !== id && (!keep || keep.has(other))) around.add(other)
    }
    graph.set(id, [...around].sort((a, b) => a - b))
  }
  // A bond to an atom missing from the molecule is not part of any ring.
  for (const [id, around] of graph) graph.set(id, around.filter((other) => graph.has(other)))
  return graph
}

/**
 * Only the ring bonds: every bond whose removal would split its piece (a bridge) goes, and
 * so do the atoms left with nothing. What remains falls apart into ring systems, which
 * keeps the ring search small even in a long chain with rings strung along it.
 */
function ringCore(graph: Graph): Graph {
  const order = new Map<number, number>()
  const low = new Map<number, number>()
  const bridges = new Set<string>()
  for (const root of graph.keys()) {
    if (order.has(root)) continue
    order.set(root, order.size)
    low.set(root, order.get(root)!)
    // Depth-first without recursion, so long chains cannot overflow the stack.
    const stack: Array<{ id: number; parent: number | null; next: number }> = [{ id: root, parent: null, next: 0 }]
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]
      const around = graph.get(frame.id)!
      if (frame.next < around.length) {
        const other = around[frame.next++]
        if (other === frame.parent) continue
        if (order.has(other)) {
          low.set(frame.id, Math.min(low.get(frame.id)!, order.get(other)!))
        } else {
          order.set(other, order.size)
          low.set(other, order.get(other)!)
          stack.push({ id: other, parent: frame.id, next: 0 })
        }
        continue
      }
      stack.pop()
      if (frame.parent == null) continue
      low.set(frame.parent, Math.min(low.get(frame.parent)!, low.get(frame.id)!))
      if (low.get(frame.id)! > order.get(frame.parent)!) bridges.add(pairKey(frame.id, frame.parent))
    }
  }
  const core: Graph = new Map()
  for (const [id, around] of graph) {
    const kept = around.filter((other) => !bridges.has(pairKey(id, other)))
    if (kept.length > 0) core.set(id, kept)
  }
  return core
}

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`)

/**
 * The 2-connected pieces of the ring core, as lists of vertex indices (a cut atom is in
 * every piece it joins). A ring never crosses a cut atom, so each piece has its rings alone.
 */
function blocks(adjacent: number[][]): number[][] {
  const order = new Int32Array(adjacent.length).fill(-1)
  const low = new Int32Array(adjacent.length)
  const found: number[][] = []
  const members: number[] = []
  let time = 0
  for (let root = 0; root < adjacent.length; root++) {
    if (order[root] >= 0) continue
    order[root] = low[root] = time++
    members.push(root)
    // Depth-first without recursion, so long chains cannot overflow the stack.
    const stack: Array<{ id: number; parent: number; next: number }> = [{ id: root, parent: -1, next: 0 }]
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]
      const around = adjacent[frame.id]
      if (frame.next < around.length) {
        const other = around[frame.next++]
        if (other === frame.parent) continue
        if (order[other] >= 0) {
          low[frame.id] = Math.min(low[frame.id], order[other])
        } else {
          order[other] = low[other] = time++
          members.push(other)
          stack.push({ id: other, parent: frame.id, next: 0 })
        }
        continue
      }
      stack.pop()
      if (frame.parent < 0) continue
      low[frame.parent] = Math.min(low[frame.parent], low[frame.id])
      if (low[frame.id] < order[frame.parent]) continue
      const block = [frame.parent]
      for (let member = -1; member !== frame.id; ) block.push((member = members.pop()!))
      found.push(block)
    }
    members.pop()
  }
  return found.filter((block) => block.length >= 3)
}

/** Same ring, same answer: start at the lowest id and go towards its lower neighbour. */
function canonical(ring: number[]): number[] {
  let start = 0
  for (let index = 1; index < ring.length; index++) if (ring[index] < ring[start]) start = index
  const turned = [...ring.slice(start), ...ring.slice(0, start)]
  if (turned.length > 2 && turned[turned.length - 1] < turned[1]) turned.splice(1, turned.length - 1, ...turned.slice(1).reverse())
  return turned
}

/** Bit set over the piece's bonds, for telling whether a ring adds anything new. */
type Bits = Uint32Array

/**
 * Smallest set of smallest rings of one 2-connected piece (Horton's candidates, kept
 * greedily while they are independent over GF(2)). Every candidate is a shortest path from
 * some atom to both ends of some bond, which always contains a minimum cycle basis.
 *
 * `around` is the piece's own graph, atoms numbered 0… in id order. A candidate (root, bond
 * x–y) is a ring when the two paths meet only at the root, i.e. x and y hang below different
 * neighbours of it, and then its length is known from the depths alone. So the lengths are
 * counted first and only the candidates of the lengths the basis needs get built.
 */
function blockRings(around: number[][]): number[][] {
  const size = around.length
  const bondA: number[] = []
  const bondB: number[] = []
  const bondOf = new Map<number, number>()
  for (let a = 0; a < size; a++) {
    for (const b of around[a]) {
      if (a >= b) continue
      bondOf.set(a * size + b, bondA.length)
      bondA.push(a)
      bondB.push(b)
    }
  }
  const rank = bondA.length - size + 1
  if (rank <= 0) return []

  const parent = new Int32Array(size)
  const depth = new Int32Array(size)
  const branch = new Int32Array(size)
  const queue = new Int32Array(size)
  /** Breadth-first from `root` through the neighbours in id order; `branch` is the root's neighbour each atom hangs below. */
  function spread(root: number) {
    parent.fill(-1)
    parent[root] = root
    depth[root] = 0
    branch[root] = -1
    queue[0] = root
    let end = 1
    for (let head = 0; head < end; head++) {
      const current = queue[head]
      for (const other of around[current]) {
        if (parent[other] >= 0) continue
        parent[other] = current
        depth[other] = depth[current] + 1
        branch[other] = current === root ? other : branch[current]
        queue[end++] = other
      }
    }
  }

  /** (root, bond) pairs of the candidate rings, by ring length, roots in order. */
  const byLength = new Map<number, number[]>()
  for (let root = 0; root < size; root++) {
    spread(root)
    for (let bond = 0; bond < bondA.length; bond++) {
      const x = bondA[bond]
      const y = bondB[bond]
      if (x === root || y === root || branch[x] === branch[y]) continue
      const length = depth[x] + depth[y] + 1
      const list = byLength.get(length)
      if (list) list.push(root, bond)
      else byLength.set(length, [root, bond])
    }
  }

  const words = Math.ceil(bondA.length / 32)
  /** Reduced rows keyed by their leading bit, for Gaussian elimination as rings arrive. */
  const basis = new Map<number, Bits>()
  const kept: number[][] = []
  for (const length of [...byLength.keys()].sort((a, b) => a - b)) {
    const list = byLength.get(length)!
    const rings = new Map<string, number[]>()
    for (let index = 0, built = -1; index < list.length; index += 2) {
      if (list[index] !== built) spread((built = list[index]))
      const x = bondA[list[index + 1]]
      const y = bondB[list[index + 1]]
      const ring: number[] = []
      for (let at = x; at !== built; at = parent[at]) ring.push(at)
      ring.push(built)
      ring.reverse()
      for (let at = y; at !== built; at = parent[at]) ring.push(at)
      const turned = canonical(ring)
      const key = turned.join(",")
      if (!rings.has(key)) rings.set(key, turned)
    }
    for (const ring of [...rings.values()].sort(compareIds)) {
      const bits: Bits = new Uint32Array(words)
      for (let index = 0; index < ring.length; index++) {
        const a = ring[index]
        const b = ring[(index + 1) % ring.length]
        const edge = bondOf.get(a < b ? a * size + b : b * size + a)!
        bits[edge >>> 5] ^= 1 << (edge & 31)
      }
      if (!reduceInto(basis, bits)) continue
      kept.push(ring)
      if (kept.length === rank) return kept
    }
  }
  return kept
}

function compareIds(a: number[], b: number[]): number {
  for (let index = 0; index < Math.min(a.length, b.length); index++) if (a[index] !== b[index]) return a[index] - b[index]
  return a.length - b.length
}

/** The lowest set bit at or after word `from`, or -1. */
function leadingBit(bits: Bits, from: number): number {
  for (let word = from; word < bits.length; word++) if (bits[word] !== 0) return word * 32 + (31 - Math.clz32(bits[word] & -bits[word]))
  return -1
}

/** Adds the row to the basis if it is independent of what is there; false if it is not. */
function reduceInto(basis: Map<number, Bits>, bits: Bits): boolean {
  // Each step clears the lowest set bit, so the next one is never in an earlier word.
  for (let lead = leadingBit(bits, 0); lead >= 0; lead = leadingBit(bits, lead >>> 5)) {
    const row = basis.get(lead)
    if (!row) {
      basis.set(lead, bits)
      return true
    }
    for (let word = lead >>> 5; word < bits.length; word++) bits[word] ^= row[word]
  }
  return false
}

/**
 * The smallest set of smallest rings, over the whole molecule or only the given atoms.
 * Each ring lists its atoms in order round the ring, starting at the lowest id; rings come
 * smallest first. Pure topology, no size cap, and the same input always gives the same rings.
 */
export function smallestRings(mol: Molecule, atoms?: Iterable<number>): number[][] {
  const core = ringCore(graphOf(mol, atoms))
  // Numbered in id order, so comparing numbers is comparing ids and neighbour lists stay sorted.
  const ids = [...core.keys()].sort((a, b) => a - b)
  const index = new Map(ids.map((id, at) => [id, at]))
  const adjacent = ids.map((id) => core.get(id)!.map((other) => index.get(other)!))
  const rings: number[][] = []
  for (const block of blocks(adjacent)) {
    block.sort((a, b) => a - b)
    const local = new Map(block.map((at, number) => [at, number]))
    const around = block.map((at) => adjacent[at].filter((other) => local.has(other)).map((other) => local.get(other)!))
    for (const ring of blockRings(around)) rings.push(ring.map((number) => ids[block[number]]))
  }
  return rings.sort((a, b) => a.length - b.length || compareIds(a, b))
}

/** Rings found once per molecule; asked on every pointer move while drawing, and per enumerated layout. */
const membership = new WeakMap<Molecule, { rings: number[][]; count: Map<number, number> }>()

/** The molecule's smallest rings, and how many of them each atom is in (0 when absent). */
export function ringMembership(mol: Molecule): { rings: number[][]; count: Map<number, number> } {
  let found = membership.get(mol)
  if (!found) {
    const rings = smallestRings(mol)
    const count = new Map<number, number>()
    for (const ring of rings) for (const id of ring) count.set(id, (count.get(id) ?? 0) + 1)
    found = { rings, count }
    membership.set(mol, found)
  }
  return found
}
