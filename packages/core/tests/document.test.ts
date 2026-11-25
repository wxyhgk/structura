import assert from "node:assert/strict"
import test from "node:test"
import { isDocument, readDocument, toDocument } from "../src/document.ts"
import { addReactionArrow, emptyDrawing } from "../src/drawing.ts"
import { applyOps } from "../src/ops.ts"
import type { Drawing } from "../src/types.ts"

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
    // Parts of the wrong shape are refused, not thrown on: an embedder's bad document must
    // not take the editor down.
    [JSON.stringify({ ...good, drawing: { ...good.drawing, molecule: { ...good.drawing.molecule, atoms: [null] } } }), /wrong shape/],
    [JSON.stringify({ ...good, drawing: { ...good.drawing, variables: { R1: null } } }), /wrong shape/],
    [JSON.stringify({ ...good, drawing: { ...good.drawing, molecule: { ...good.drawing.molecule, groups: 0 } } }), /incomplete/],
    // A counter or id that is text would turn the next id into "71".
    [JSON.stringify({ ...good, drawing: { ...good.drawing, nextArrowId: "7" } }), /whole numbers/],
    [JSON.stringify({ ...good, drawing: { ...good.drawing, molecule: { ...good.drawing.molecule, nextGroupId: 1.5 } } }), /whole numbers/],
    [JSON.stringify({ ...good, drawing: { ...good.drawing, arrows: good.drawing.arrows.map((arrow: { id: number }) => ({ ...arrow, id: String(arrow.id) })) } }), /whole-number id/],
  ]
  for (const [text, message] of cases) {
    const read = readDocument(text)
    assert.ok("error" in read && message.test(read.error), text.slice(0, 60))
  }
  assert.ok(!isDocument("Structura\n  molfile"))
  // A counter past 2^53 cannot count up (n + 1 is n).
  const huge = readDocument(JSON.stringify({ ...good, drawing: { ...good.drawing, molecule: { ...good.drawing.molecule, nextAtomId: 2 ** 60 } } }))
  assert.ok("error" in huge && /whole numbers/.test(huge.error))
})

test("a file saved with a byte-order mark opens", () => {
  const text = `\ufeff${toDocument(formula())}`
  assert.ok(isDocument(text))
  assert.ok("drawing" in readDocument(text))
})

test("generation settings and compound numbers survive a save and an open", () => {
  const drawing: Drawing = {
    ...formula(),
    generation: { representatives: false, dedupe: true, limit: 2000 },
    numbering: { pattern: "化合物{n}", start: 5, assigned: { "s:CCO": 5, "p:R1=Cl": 6 } },
  }
  const read = readDocument(toDocument(drawing))
  assert.ok("drawing" in read)
  assert.deepEqual(read.drawing.generation, drawing.generation)
  assert.deepEqual(read.drawing.numbering, drawing.numbering)
})

test("a file from before generation settings and numbering opens without them", () => {
  const read = readDocument(toDocument(formula()))
  assert.ok("drawing" in read)
  assert.equal(read.drawing.generation, undefined)
  assert.equal(read.drawing.numbering, undefined)
  assert.ok(!toDocument(formula()).includes("numbering"))
})

test("generation settings and numbering that cannot be used say why", () => {
  const good = JSON.parse(toDocument(formula()))
  const cases: Array<[Record<string, unknown>, RegExp]> = [
    [{ generation: { limit: 0 } }, /limit/],
    [{ generation: { dedupe: "yes" } }, /dedupe/],
    [{ generation: [] }, /generation settings/],
    [{ numbering: { pattern: "C-{n}", start: 1.5 } }, /first compound number/],
    [{ numbering: { pattern: 3, start: 1 } }, /pattern/],
    [{ numbering: { pattern: "C-{n}", start: 1, assigned: { "s:C": 1, "s:N": 1 } } }, /two compounds/],
    [{ numbering: { pattern: "C-{n}", start: 1, assigned: { "s:C": "1" } } }, /whole number/],
  ]
  for (const [extra, message] of cases) {
    const read = readDocument(JSON.stringify({ ...good, drawing: { ...good.drawing, ...extra } }))
    assert.ok("error" in read && message.test(read.error), JSON.stringify(extra))
  }
})
