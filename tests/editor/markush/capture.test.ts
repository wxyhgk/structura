import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "@structura/core"
import { applyOps, type Op } from "@structura/core/ops"
import type { Drawing } from "@structura/core/types"
import { captureOps } from "../../../src/editor/markush/capture.ts"

function run(drawing: Drawing, ops: Op[]): Drawing {
  const result = applyOps(drawing, ops)
  assert.ok(result.ok, result.ok ? "" : result.error)
  return result.drawing
}

/** Benzene with R1, and apart from it a pyridine-like ring carrying a "*". */
function drawing(star = true): Drawing {
  return run(emptyDrawing(), [
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 1, as: "r" },
    { op: "label", atom: "r", text: "R1" },
    { op: "add_ring", at: { x: 400, y: 0 }, kind: "benzene" },
    ...(star ? ([{ op: "add_atom", el: "C", to: 8, as: "s" }, { op: "label", atom: "s", text: "*" }] satisfies Op[]) : []),
  ])
}

const pieceAtoms = (drawn: Drawing) => drawn.molecule.atoms.filter((atom) => atom.id >= 8).map((atom) => atom.id)

test("the selected piece moves off the canvas into the variable's list, as one step", () => {
  const drawn = drawing()
  const result = captureOps("R1", [{ kind: "label", text: "H" }], drawn.molecule, pieceAtoms(drawn))
  assert.ok("ops" in result)
  const after = run(drawn, result.ops)
  assert.equal(after.molecule.atoms.length, 7)
  const list = after.variables?.R1
  assert.ok(list && "alternatives" in list)
  assert.deepEqual(list.alternatives.map((item) => item.kind), ["label", "fragment"])
})

test("a selection that will not do says why, in words the chemist can act on", () => {
  const drawn = drawing()
  assert.match((captureOps("R1", [], drawn.molecule, []) as { problem: string }).problem, /选中/)
  const noStar = drawing(false)
  assert.match((captureOps("R1", [], noStar.molecule, pieceAtoms(noStar)) as { problem: string }).problem, /\*/)
  // Part of the formula with it: still bonded to atoms left out.
  assert.match((captureOps("R1", [], drawn.molecule, [1, 2, 3]) as { problem: string }).problem, /连着/)
})
