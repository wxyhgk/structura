import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "../../src/drawing.ts"
import { assignNumbers, DEFAULT_NUMBERING, nextNumber } from "../../src/markush/numbering.ts"
import { applyOps, type Op } from "../../src/ops.ts"

test("new compounds follow the highest number given out, and those with one keep it", () => {
  const first = assignNumbers(DEFAULT_NUMBERING, ["a", "b", "c"])
  assert.deepEqual(first.assigned, { a: 1, b: 2, c: 3 })
  // "b" is gone and "d" is new: "b" keeps 2 (never reused), "d" is 4 whatever its place in the list.
  const second = assignNumbers(first, ["d", "c", "a"])
  assert.deepEqual(second.assigned, { a: 1, b: 2, c: 3, d: 4 })
  assert.equal(nextNumber(second), 5)
  assert.equal(assignNumbers(second, ["a", "d"]), second)
})

test("the first number is the start, and a repeated identity is numbered once", () => {
  const numbering = assignNumbers({ pattern: "1-{n}", start: 10 }, ["a", "a", "b"])
  assert.deepEqual(numbering.assigned, { a: 10, b: 11 })
})

test("ops set the generation, the numbering and the numbers, and clear the numbers", () => {
  const start = emptyDrawing()
  const done = applyOps(start, [
    { op: "set_generation", generation: { dedupe: false } },
    { op: "set_generation", generation: { limit: 100 } },
    { op: "set_numbering", pattern: "化合物{n}", start: 3 },
    { op: "assign_numbers", keys: ["s:CCO", "s:CCN"] },
  ])
  assert.ok(done.ok)
  assert.deepEqual(done.drawing.generation, { dedupe: false, limit: 100 })
  assert.deepEqual(done.drawing.numbering, { pattern: "化合物{n}", start: 3, assigned: { "s:CCO": 3, "s:CCN": 4 } })
  // Changing how numbers are written keeps the numbers.
  const again = applyOps(done.drawing, [{ op: "set_numbering", pattern: "C-{n}" }])
  assert.ok(again.ok)
  assert.deepEqual(again.drawing.numbering?.assigned, { "s:CCO": 3, "s:CCN": 4 })
  const cleared = applyOps(done.drawing, [{ op: "clear_numbers" }])
  assert.ok(cleared.ok)
  assert.deepEqual(cleared.drawing.numbering, { pattern: "化合物{n}", start: 3 })
  // The numbers are part of the document, so the original drawing is untouched.
  assert.equal(start.numbering, undefined)
})

test("ops refuse settings that cannot be kept", () => {
  const refused: Op[] = [
    { op: "set_generation", generation: { limit: -1 } },
    { op: "set_numbering", start: 1.5 },
    { op: "assign_numbers", keys: [""] },
  ]
  for (const op of refused) {
    const result = applyOps(emptyDrawing(), [op])
    assert.ok(!result.ok, JSON.stringify(op))
  }
})
