import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "@structura/core"
import { toMolfile } from "@structura/core/molfile"
import type { Op } from "@structura/core/ops"
import { build, tryRun } from "@structura/testkit"

// What an agent (or a bug) might send. Every one is refused with a message, nothing changes,
// and nothing escapes as an exception: bad values never reach a saved file or a MOL export.

const ethane = () => build([{ op: "draw_bond", start: { x: 0, y: 0 } }])
const malformed = (ops: unknown) => tryRun(ethane(), ops as Op[])

test("values the types do not allow are refused, so they never reach a file", () => {
  for (const op of [
    { op: "set_bond", bond: 1, order: 9 },
    { op: "set_bond", bond: 1, stereo: "sideways" },
    { op: "add_atom", el: "C", to: 1, order: 7 },
    { op: "set_charge", atom: 1, charge: 2.5 },
    { op: "set_element", atom: 1, el: "Xx" },
  ]) {
    const drawing = ethane()
    const result = tryRun(drawing, [op] as Op[])
    assert.equal(result.ok, false, JSON.stringify(op))
    assert.equal(result.drawing, drawing, "nothing changed")
  }
  assert.ok(toMolfile(ethane().molecule).includes("  1  2  1"), "a good drawing still exports")
})

test("ops of the wrong shape fail cleanly instead of throwing", () => {
  for (const ops of [[{ op: "label", atom: 1, text: 42 }], [{ op: "rotate", atoms: [1], angle: null }], [{ op: "move", atoms: [1], dx: "3", dy: 0 }], [42], [null], [{ name: "add_atom" }], "add_atom", [{ op: "no_such_op" }]]) {
    let result
    assert.doesNotThrow(() => (result = malformed(ops)), JSON.stringify(ops))
    assert.equal(result!.ok, false, JSON.stringify(ops))
    assert.ok(!result!.ok && result!.error.length > 0)
  }
})

test("a ring placed on its own keeps the name it was given", () => {
  const result = tryRun(emptyDrawing(), [
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene", as: "ring" },
    { op: "add_atom", el: "O", to: "ring" },
  ])
  assert.ok(result.ok, result.ok ? "" : result.error)
})
