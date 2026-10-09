import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "@structura/core"
import { placeDrawing } from "@structura/engine"
import { build } from "@structura/testkit"

const incoming = build([{ op: "draw_bond", start: { x: 0, y: 0 } }])

test("on an empty page the whole drawing goes in", () => {
  assert.deepEqual(placeDrawing(emptyDrawing(), incoming), { load: incoming })
})

test("beside a drawing, only its molecule is added", () => {
  const page = build([{ op: "add_atom", el: "O" }])
  assert.deepEqual(placeDrawing(page, incoming), { append: incoming.molecule })
})
