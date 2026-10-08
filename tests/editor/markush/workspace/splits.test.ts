import assert from "node:assert/strict"
import test from "node:test"
import { clampSplit, DEFAULT_SPLITS } from "../../../../src/editor/markush/workspace/useSplits.ts"

test("a divider dragged too far stops where both panes stay usable", () => {
  assert.equal(clampSplit("left", 0.05), 0.3)
  assert.equal(clampSplit("left", 0.99), 0.75)
  assert.equal(clampSplit("top", 0.95), 0.82)
  assert.equal(clampSplit("top", 0.5), 0.5)
})

test("the default places are within the limits", () => {
  assert.equal(clampSplit("left", DEFAULT_SPLITS.left), DEFAULT_SPLITS.left)
  assert.equal(clampSplit("top", DEFAULT_SPLITS.top), DEFAULT_SPLITS.top)
})
