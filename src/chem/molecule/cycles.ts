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

function components(graph: Graph): number[][] {
  const seen = new Set<number>()
  const found: number[][] = []
  for (const start of graph.keys()) {
    if (seen.has(start)) continue
    seen.add(start)
    const piece = [start]
    for (let index = 0; index < piece.length; index++) {
      for (const other of graph.get(piece[index])!) {
        if (seen.has(other)) continue
        seen.add(other)
        piece.push(other)
      }
    }
    found.push(piece)
  }
  return found
}

/** Breadth-first parents from `root`, so the shortest path to any atom can be walked back. */
function shortestTree(graph: Graph, root: number): Map<number, number | null> {
  const parent = new Map<number, number | null>([[root, null]])
  const queue = [root]
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index]
    for (const other of graph.get(current)!) {
      if (parent.has(other)) continue
      parent.set(other, current)
      queue.push(other)
    }
  }
  return parent
}

/** root … id along the tree. */
function pathTo(parent: Map<number, number | null>, id: number): number[] {
  const path: number[] = []
  for (let cursor: number | null = id; cursor != null; cursor = parent.get(cursor) ?? null) path.push(cursor)
  return path.reverse()
}

/** Same ring, same answer: start at the lowest id and go towards its lower neighbour. */
function canonical(ring: number[]): number[] {
  const start = ring.indexOf(Math.min(...ring))
  const turned = [...ring.slice(start), ...ring.slice(0, start)]
  if (turned.length > 2 && turned[turned.length - 1] < turned[1]) turned.splice(1, turned.length - 1, ...turned.slice(1).reverse())
  return turned
}

/** Bit set over the component's bonds, for telling whether a ring adds anything new. */
type Bits = Uint32Array

/**
 * Smallest set of smallest rings of one ring-bearing component (Horton's candidates, kept
 * greedily while they are independent over GF(2)). Every candidate is a shortest path from
 * some atom to both ends of some bond, which always contains a minimum cycle basis.
 */
function componentRings(graph: Graph, piece: number[]): number[][] {
  const edgeIndex = new Map<string, number>()
  for (const id of piece) {
    for (const other of graph.get(id)!) if (id < other) edgeIndex.set(`${id}-${other}`, edgeIndex.size)
  }
  const rank = edgeIndex.size - piece.length + 1
  if (rank <= 0) return []

  const edgeOf = (a: number, b: number) => edgeIndex.get(a < b ? `${a}-${b}` : `${b}-${a}`)!
  const candidates = new Map<string, number[]>()
  for (const root of piece) {
    const parent = shortestTree(graph, root)
    for (const x of piece) {
      const toX = pathTo(parent, x)
      const onX = new Set(toX)
      for (const y of graph.get(x)!) {
        if (x > y) continue
        const toY = pathTo(parent, y)
        // The two paths may only meet at the root, or the loop is not a simple ring.
        if (toY.slice(1).some((id) => onX.has(id))) continue
        const ring = canonical([...toX, ...toY.slice(1).reverse()])
        if (ring.length < 3) continue
        const key = ring.join(",")
        if (!candidates.has(key)) candidates.set(key, ring)
      }
    }
  }

  const sorted = [...candidates.values()].sort((a, b) => a.length - b.length || compareIds(a, b))
  const words = Math.ceil(edgeIndex.size / 32)
  /** Reduced rows keyed by their leading bit, for Gaussian elimination as rings arrive. */
  const basis = new Map<number, Bits>()
  const kept: number[][] = []
  for (const ring of sorted) {
    const bits: Bits = new Uint32Array(words)
    for (let index = 0; index < ring.length; index++) {
      const edge = edgeOf(ring[index], ring[(index + 1) % ring.length])
      bits[edge >>> 5] ^= 1 << (edge & 31)
    }
    if (!reduceInto(basis, bits)) continue
    kept.push(ring)
    if (kept.length === rank) break
  }
  return kept
}

function compareIds(a: number[], b: number[]): number {
  for (let index = 0; index < Math.min(a.length, b.length); index++) if (a[index] !== b[index]) return a[index] - b[index]
  return a.length - b.length
}

function leadingBit(bits: Bits): number {
  for (let word = 0; word < bits.length; word++) if (bits[word] !== 0) return word * 32 + (31 - Math.clz32(bits[word] & -bits[word]))
  return -1
}

/** Adds the row to the basis if it is independent of what is there; false if it is not. */
function reduceInto(basis: Map<number, Bits>, bits: Bits): boolean {
  for (let lead = leadingBit(bits); lead >= 0; lead = leadingBit(bits)) {
    const row = basis.get(lead)
    if (!row) {
      basis.set(lead, bits)
      return true
    }
    for (let word = 0; word < bits.length; word++) bits[word] ^= row[word]
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
  const rings = components(core).flatMap((piece) => componentRings(core, piece))
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
