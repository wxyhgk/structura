import assert from "node:assert/strict"
import test from "node:test"
import type { Molecule } from "@structura/core/types"
import { arrowDirection, chainEndToward, createHotspot, neighborToward } from "@structura/engine"

// Arrow keys move the hotspot along bonds: one step to the neighbour that way, or with Shift
// along the chain to its end or first branch. Drawing coordinates, y downward.

/** Atoms 1, 2, 3… at these points, single bonds between the given pairs. */
function molecule(points: Array<[number, number]>, bonds: Array<[number, number]>): Molecule {
  return {
    atoms: points.map(([x, y], index) => ({ id: index + 1, el: "C", x, y, charge: 0 })),
    bonds: bonds.map(([a, b], index) => ({ id: index + 1, a, b, order: 1, stereo: "none" })),
    groups: [],
    nextAtomId: points.length + 1,
    nextBondId: bonds.length + 1,
    nextGroupId: 1,
  }
}

const R = 40
const H = R * Math.cos(Math.PI / 6)
/** Benzene with a vertex on top: 1 top, then clockwise 2 upper right, 3 lower right, 4 bottom, 5 lower left, 6 upper left. */
const BENZENE = molecule(
  [[0, -R], [H, -R / 2], [H, R / 2], [0, R], [-H, R / 2], [-H, -R / 2]],
  [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1]],
)
/** Hexane drawn as a zigzag to the right: odd atoms low, even atoms high. */
const HEXANE = molecule(
  Array.from({ length: 6 }, (_, index): [number, number] => [index * H, index % 2 === 1 ? -R / 2 : 0]),
  [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
)
/** 2-methylpentane's shape: a zigzag 1–2–3–4–5 with 6 hanging down from 3. */
const BRANCHED = molecule(
  [[0, 0], [H, -R / 2], [2 * H, 0], [3 * H, -R / 2], [4 * H, 0], [2 * H, R]],
  [[1, 2], [2, 3], [3, 4], [4, 5], [3, 6]],
)

const right = arrowDirection("ArrowRight")!
const left = arrowDirection("ArrowLeft")!
const up = arrowDirection("ArrowUp")!
const down = arrowDirection("ArrowDown")!

test("only the four arrow keys have a direction, y downward as on the screen", () => {
  assert.deepEqual(up, { x: 0, y: -1 })
  assert.deepEqual(down, { x: 0, y: 1 })
  assert.equal(arrowDirection("a"), null)
  assert.equal(arrowDirection("Enter"), null)
})

test("benzene: an arrow steps to the neighbour most nearly that way, and nowhere when every bond turns away", () => {
  assert.equal(neighborToward(BENZENE, 1, right), 2)
  assert.equal(neighborToward(BENZENE, 1, left), 6)
  assert.equal(neighborToward(BENZENE, 2, down), 3)
  assert.equal(neighborToward(BENZENE, 2, up), 1, "a bond 60° off still goes that way")
  assert.equal(neighborToward(BENZENE, 1, up), null, "both bonds lead down")
  assert.equal(neighborToward(BENZENE, 2, right), null, "one bond square to the key, one against it")
  assert.equal(neighborToward(BENZENE, 99, right), null, "no such atom")
})

test("a chain: one step at a time, or with Shift to its end", () => {
  assert.equal(neighborToward(HEXANE, 1, right), 2)
  assert.equal(neighborToward(HEXANE, 2, right), 3)
  assert.equal(neighborToward(HEXANE, 1, up), 2)
  assert.equal(neighborToward(HEXANE, 1, down), null)
  assert.equal(chainEndToward(HEXANE, 1, right), 6)
  assert.equal(chainEndToward(HEXANE, 3, right), 6)
  assert.equal(chainEndToward(HEXANE, 6, left), 1)
  assert.equal(chainEndToward(HEXANE, 6, right), null, "nothing further that way")
})

test("a branch: Shift stops on it, and from there goes on down the branch the key points along", () => {
  assert.equal(chainEndToward(BRANCHED, 1, right), 3)
  assert.equal(chainEndToward(BRANCHED, 3, right), 5)
  assert.equal(chainEndToward(BRANCHED, 3, down), 6)
  assert.equal(chainEndToward(BRANCHED, 5, left), 3)
})

test("a ring is crossed, not circled: Shift stops where the next bond would turn back against the key", () => {
  assert.equal(chainEndToward(BENZENE, 6, right), 2)
  assert.equal(chainEndToward(BENZENE, 2, down), 4)
  assert.equal(chainEndToward(BENZENE, 1, left), 6, "the next bond is square to the key")
})

test("the step lands in the hotspot: pinned while the pointer rests where the key was pressed, so arrows chain", () => {
  const hotspot = createHotspot()
  hotspot.track(0, 0, () => ({ type: "atom", id: 1 }))
  hotspot.assignHover({ type: "atom", id: 1 })
  for (const expected of [2, 3, 4]) {
    const from = hotspot.active(HEXANE)!
    hotspot.remember({ type: "atom", id: neighborToward(HEXANE, from.id, right)! }, HEXANE)
    assert.deepEqual(hotspot.active(HEXANE), { type: "atom", id: expected })
  }
})
