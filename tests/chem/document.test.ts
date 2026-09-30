import assert from "node:assert/strict"
import test from "node:test"
import { isDocument, readDocument, toDocument } from "../../src/chem/document.ts"
import { addReactionArrow, emptyDrawing } from "../../src/chem/drawing.ts"
import { applyOps } from "../../src/chem/ops.ts"
import type { Drawing } from "../../src/chem/types.ts"

function formula(): Drawing {
  const built = applyOps(emptyDrawing(), [
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "cyclopentane" },
    { op: "label", atom: 1, text: "X" },
    { op: "add_atom", el: "C", to: 3, as: "r" },
    { op: "label", atom: "r", text: "R1" },
    { op: "set_variable", name: "X", alternatives: [{ kind: "label", text: "O" }, { kind: "label", text: "S" }] },
    { op: "set_variable", name: "R1", alternatives: [{ kind: "label", text: "H" }, { kind: "class", class: "aryl", min: 6, max: 30 }] },
  ])
  assert.ok(built.ok)
  return addReactionArrow(built.drawing, [1, 2], "right")
}

test("a drawing with its generic-formula variables survives a save and an open", () => {
  const drawing = formula()
  const text = toDocument(drawing)
  assert.ok(isDocument(text))
  const read = readDocument(text)
  assert.ok("drawing" in read)
  // Fields left undefined (an atom with no alias) are simply absent after the round trip.
  assert.deepEqual(read.drawing, JSON.parse(JSON.stringify(drawing)))
})

test("a file that cannot be used says why", () => {
  const good = JSON.parse(toDocument(formula()))
  const cases: Array<[string, RegExp]> = [
    ["{ not json", /not valid JSON/],
    [JSON.stringify({ format: "other", version: 1, drawing: good.drawing }), /not a Structura file/],
    [JSON.stringify({ ...good, version: 99 }), /newer Structura/],
    [JSON.stringify({ ...good, drawing: { arrows: [] } }), /incomplete/],
    [JSON.stringify({ ...good, drawing: { ...good.drawing, variables: { R1: { alternatives: [] } } } }), /at least one alternative/],
    [JSON.stringify({ ...good, drawing: { ...good.drawing, molecule: { ...good.drawing.molecule, nextAtomId: 2 } } }), /not below nextAtomId/],
  ]
  for (const [text, message] of cases) {
    const read = readDocument(text)
    assert.ok("error" in read && message.test(read.error), text.slice(0, 60))
  }
  assert.ok(!isDocument("Structura\n  molfile"))
})
