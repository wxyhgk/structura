import assert from "node:assert/strict"
import test from "node:test"
import { odometer } from "../../src/markush/odometer.ts"

test("the odometer turns the last wheel fastest and visits every combination once", () => {
  assert.deepEqual([...odometer([2, 3])], [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]])
  assert.deepEqual([...odometer([])], [[]], "no wheels: one empty combination")
  assert.deepEqual([...odometer([3, 0, 2])], [], "a wheel with no positions: none")
})

test("each combination is its own array, and stopping early is fine", () => {
  const seen: number[][] = []
  for (const index of odometer([4, 4])) {
    seen.push(index)
    if (seen.length === 3) break
  }
  assert.deepEqual(seen, [[0, 0], [0, 1], [0, 2]])
})
