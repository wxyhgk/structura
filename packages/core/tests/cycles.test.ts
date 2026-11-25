import assert from "node:assert/strict"
import test from "node:test"
import { ringMembership, smallestRings } from "../src/molecule/cycles.ts"
import { referenceSmallestRings } from "./support/hortonReference.ts"
import type { Molecule } from "../src/types.ts"

/** A molecule from a bond list; coordinates do not matter to ring perception. */
function graph(bonds: Array<[number, number]>): Molecule {
  const ids = [...new Set(bonds.flat())].sort((a, b) => a - b)
  return {
    atoms: ids.map((id) => ({ id, el: "C", x: 0, y: 0, charge: 0 })),
    bonds: bonds.map(([a, b], index) => ({ id: index + 1, a, b, order: 1, stereo: "none" })),
    groups: [],
    nextAtomId: Math.max(...ids) + 1,
    nextBondId: bonds.length + 1,
    nextGroupId: 1,
  }
}

function cycle(ids: number[]): Array<[number, number]> {
  return ids.map((id, index) => [id, ids[(index + 1) % ids.length]])
}

const sizes = (rings: number[][]) => rings.map((ring) => ring.length)

test("benzene is one six-membered ring in order round the ring", () => {
  const rings = smallestRings(graph(cycle([4, 2, 6, 1, 3, 5])))
  assert.deepEqual(rings, [[1, 3, 5, 4, 2, 6]])
})

test("naphthalene is two hexagons, not the ten-membered rim", () => {
  const rings = smallestRings(graph([...cycle([1, 2, 3, 4, 5, 6]), [5, 7], [7, 8], [8, 9], [9, 10], [10, 6]]))
  assert.deepEqual(sizes(rings), [6, 6])
  assert.deepEqual(rings[0], [1, 2, 3, 4, 5, 6])
  assert.deepEqual([...rings[1]].sort((a, b) => a - b), [5, 6, 7, 8, 9, 10])
})

test("a chain between rings and dangling chains are not rings", () => {
  const rings = smallestRings(graph([...cycle([1, 2, 3]), [3, 10], [10, 11], [11, 20], ...cycle([20, 21, 22, 23]), [23, 30]]))
  assert.deepEqual(sizes(rings), [3, 4])
})

test("spiro rings share one atom", () => {
  const rings = smallestRings(graph([...cycle([1, 2, 3, 4, 5]), ...cycle([1, 6, 7, 8])]))
  assert.deepEqual(sizes(rings), [4, 5])
  assert.ok(rings.every((ring) => ring.includes(1)))
})

test("norbornane is two five-membered rings", () => {
  // C1 and C4 are the bridgeheads, C7 the one-carbon bridge.
  const rings = smallestRings(graph([[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1], [1, 7], [7, 4]]))
  assert.deepEqual(sizes(rings), [5, 5])
  assert.ok(rings.every((ring) => ring.includes(7)))
})

test("cubane has five four-membered rings", () => {
  const top = cycle([1, 2, 3, 4])
  const bottom = cycle([5, 6, 7, 8])
  const rings = smallestRings(graph([...top, ...bottom, [1, 5], [2, 6], [3, 7], [4, 8]]))
  assert.deepEqual(sizes(rings), [4, 4, 4, 4, 4])
})

test("a twelve-membered macrocycle is found whole", () => {
  const ring = Array.from({ length: 12 }, (_, index) => index + 1)
  assert.deepEqual(smallestRings(graph(cycle(ring))), [ring])
})

test("disconnected fragments each keep their rings", () => {
  const rings = smallestRings(graph([...cycle([1, 2, 3, 4, 5, 6]), ...cycle([11, 12, 13, 14, 15]), [21, 22]]))
  assert.deepEqual(rings, [[11, 12, 13, 14, 15], [1, 2, 3, 4, 5, 6]])
})

test("only the given atoms count when a set is passed", () => {
  const mol = graph([...cycle([1, 2, 3, 4, 5, 6]), ...cycle([11, 12, 13, 14, 15])])
  assert.deepEqual(smallestRings(mol, [11, 12, 13, 14, 15, 1, 2]), [[11, 12, 13, 14, 15]])
})

test("the same molecule always gives the same rings", () => {
  const bonds: Array<[number, number]> = [...cycle([1, 2, 3, 4, 5, 6, 7, 8]), [1, 5], [3, 7]]
  const first = smallestRings(graph(bonds))
  assert.deepEqual(smallestRings(graph([...bonds].reverse())), first)
  assert.deepEqual(sizes(first), [5, 5, 5])
})

// The ring search was made faster (2-connected pieces, candidates built by length); it has
// to give exactly what the plain Horton search gave, rings and order.

/** A small seeded generator, so a failure can be replayed. */
function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

function sameRings(mol: Molecule, atoms?: number[]) {
  assert.deepEqual(smallestRings(mol, atoms), referenceSmallestRings(mol, atoms))
}

function grid(width: number, height: number): Array<[number, number]> {
  const at = (x: number, y: number) => y * width + x + 1
  const bonds: Array<[number, number]> = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x + 1 < width) bonds.push([at(x, y), at(x + 1, y)])
      if (y + 1 < height) bonds.push([at(x, y), at(x, y + 1)])
    }
  }
  return bonds
}

test("known ring systems give the same rings as the plain search", () => {
  const cubane = [[1, 2], [2, 3], [3, 4], [4, 1], [5, 6], [6, 7], [7, 8], [8, 5], [1, 5], [2, 6], [3, 7], [4, 8]] as Array<[number, number]>
  const complete = [1, 2, 3, 4, 5, 6].flatMap((a) => [1, 2, 3, 4, 5, 6].filter((b) => b > a).map((b): [number, number] => [a, b]))
  const spiroChain = [...cycle([1, 2, 3, 4, 5]), ...cycle([5, 6, 7]), ...cycle([7, 8, 9, 10]), [10, 11], ...cycle([11, 12, 13])] as Array<[number, number]>
  for (const bonds of [cubane, complete, spiroChain, grid(7, 5), grid(12, 12), [...cycle([1, 2, 3, 4, 5, 6]), ...cycle([4, 7, 8, 9, 10, 11]), [1, 20], [20, 21], ...cycle([21, 22, 23])] as Array<[number, number]>]) {
    sameRings(graph(bonds))
  }
})

test("random graphs give the same rings as the plain search", () => {
  const random = seeded(20240611)
  for (let round = 0; round < 400; round++) {
    const count = 2 + Math.floor(random() * 28)
    const bonds = new Map<string, [number, number]>()
    const extra = Math.floor(random() * count * 0.9)
    // A forest of random trees (chains and branches), then extra bonds close rings of every size.
    for (let id = 2; id <= count; id++) {
      if (random() < 0.12) continue
      const other = 1 + Math.floor(random() * (id - 1))
      bonds.set(`${other}-${id}`, [other, id])
    }
    for (let index = 0; index < extra; index++) {
      const a = 1 + Math.floor(random() * count)
      const b = 1 + Math.floor(random() * count)
      if (a !== b) bonds.set(a < b ? `${a}-${b}` : `${b}-${a}`, a < b ? [a, b] : [b, a])
    }
    if (bonds.size === 0) continue
    const mol = graph([...bonds.values()])
    // Ids with gaps, so numbering by position is not the same as by id.
    const scale = 1 + Math.floor(random() * 3)
    const spread: Molecule = {
      ...mol,
      atoms: mol.atoms.map((atom) => ({ ...atom, id: atom.id * scale + 7 })),
      bonds: mol.bonds.map((bond) => ({ ...bond, a: bond.a * scale + 7, b: bond.b * scale + 7 })),
    }
    sameRings(spread)
    sameRings(spread, spread.atoms.filter(() => random() < 0.7).map((atom) => atom.id))
  }
})

test("sparse and ring-rich random graphs of some size give the same rings as the plain search", () => {
  const random = seeded(7)
  for (const [count, bondCount] of [[60, 70], [60, 120], [80, 100], [40, 120]]) {
    const bonds = new Map<string, [number, number]>()
    while (bonds.size < bondCount) {
      const a = 1 + Math.floor(random() * count)
      const b = 1 + Math.floor(random() * count)
      if (a !== b) bonds.set(a < b ? `${a}-${b}` : `${b}-${a}`, a < b ? [a, b] : [b, a])
    }
    sameRings(graph([...bonds.values()]))
  }
})

test("ring counts follow a molecule changed in place after they were asked for", () => {
  const atoms = Array.from({ length: 6 }, (_, at) => ({ id: at + 1, el: "C", x: at * 40, y: 0, charge: 0 }))
  const bonds = Array.from({ length: 5 }, (_, at) => ({ id: at + 1, a: at + 1, b: at + 2, order: 1 as const, stereo: "none" as const }))
  const chain: Molecule = { atoms, bonds, groups: [], nextAtomId: 7, nextBondId: 6, nextGroupId: 1 }
  assert.equal(ringMembership(chain).count.size, 0)
  chain.bonds.push({ id: 6, a: 6, b: 1, order: 1, stereo: "none" })
  assert.equal(ringMembership(chain).count.size, 6)
  assert.equal(ringMembership(chain).rings.length, 1)
})
