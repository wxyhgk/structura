import assert from "node:assert/strict"
import test from "node:test"
import { smallestRings } from "../../src/chem/molecule/cycles.ts"
import type { Molecule } from "../../src/chem/types.ts"

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
