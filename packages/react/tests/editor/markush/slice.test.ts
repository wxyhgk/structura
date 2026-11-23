import assert from "node:assert/strict"
import test from "node:test"
import { runSlice } from "../../../src/editor/markush/slice.ts"
import { progressText } from "../../../src/editor/markush/progressText.ts"

function* counting(failAt?: number): Generator<number, string> {
  for (let i = 1; ; i++) {
    if (i === failAt) throw new Error("boom")
    if (i > 5) return "end"
    yield i
  }
}

test("a slice runs until the page should have its turn", () => {
  let budget = 2
  const slice = runSlice(counting(), () => budget-- > 0)
  assert.deepEqual(slice, { step: { done: false, value: 3 } })
})

test("a slice that reaches the end hands back the result", () => {
  assert.deepEqual(runSlice(counting(), () => true), { step: { done: true, value: "end" } })
})

test("a step that throws ends the slice with the error and the last step made", () => {
  const slice = runSlice(counting(3), () => true)
  assert.deepEqual(slice, { error: "boom", last: { done: false, value: 2 } })
  assert.deepEqual(runSlice(counting(1), () => true), { error: "boom", last: null })
})

test("a run that failed says so, with how much was made", () => {
  assert.match(progressText({ result: null, status: "stopped", error: "boom" }, 500), /^生成时出错，已停止：boom$/)
})
