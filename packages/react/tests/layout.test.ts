import assert from "node:assert/strict"
import test from "node:test"
import { layoutFor } from "../src/editor/shell/layout.ts"

test("the layout goes by the editor's own box: full, compact below 720×520, mini below 480×360, either side counting", () => {
  assert.equal(layoutFor(1280, 800), "full")
  assert.equal(layoutFor(720, 520), "full")
  assert.equal(layoutFor(719, 800), "compact")
  assert.equal(layoutFor(1280, 519), "compact")
  assert.equal(layoutFor(480, 360), "compact")
  assert.equal(layoutFor(479, 800), "mini")
  assert.equal(layoutFor(1280, 359), "mini")
})

test("a box not laid out yet (hidden, 0×0) is full, so the editor does not settle into mini before it is shown", () => {
  assert.equal(layoutFor(0, 0), "full")
  assert.equal(layoutFor(800, 0), "full")
})
