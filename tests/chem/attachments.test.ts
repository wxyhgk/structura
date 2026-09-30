import assert from "node:assert/strict"
import test from "node:test"
import { readDocument, toDocument } from "../../src/chem/document.ts"
import { emptyDrawing } from "../../src/chem/drawing.ts"
import { plainFormula } from "../../src/chem/formula.ts"
import { ringPositionsAt } from "../../src/chem/markush/attachments.ts"
import { enumerate } from "../../src/chem/markush/enumerate.ts"
import { applyOps, type Op } from "../../src/chem/ops.ts"
import type { Drawing } from "../../src/chem/types.ts"

function run(drawing: Drawing, ops: Op[]): Drawing {
  const result = applyOps(drawing, ops)
  assert.ok(result.ok, result.ok ? "" : `op ${result.index}: ${result.error}`)
  return result.drawing
}

const label = (text: string) => ({ kind: "label" as const, text })

/** Benzene (atoms 1–6) with R2 on atom 2, and –L–ETU off to the side, attached to any of atoms 1, 2, 3. */
function formula(): Drawing {
  return run(emptyDrawing(), [
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 2, as: "r2" },
    { op: "label", atom: "r2", text: "R2" },
    { op: "place_atom", el: "C", at: { x: 200, y: 0 } },
    { op: "label", atom: 8, text: "L" },
    { op: "add_atom", el: "C", to: 8, as: "etu" },
    { op: "label", atom: "etu", text: "ETU" },
    { op: "set_attachment", atom: 8, to: [1, 2, 3] },
    { op: "set_variable", name: "R2", alternatives: [label("H"), label("F")] },
    { op: "set_variable", name: "L", alternatives: [label("O")] },
    { op: "set_variable", name: "ETU", alternatives: [label("Ph")] },
  ])
}

test("a variable attachment is placed at each candidate in turn, displacing the R there", () => {
  const result = enumerate(formula())
  // On atom 1 or 3, R2 still chooses H or F; on atom 2, –L–ETU takes R2's place.
  assert.equal(result.total, 5)
  assert.deepEqual([result.molecules.length, result.failed], [5, 0])
  const formulas = result.molecules.map((mol) => plainFormula(mol)).sort()
  assert.deepEqual(formulas, ["C12H10O", "C12H10O", "C12H10O", "C12H9FO", "C12H9FO"])
  for (const mol of result.molecules) assert.ok(mol.atoms.every((atom) => !atom.alias), "no placeholder is left")
})

test("attachments are checked, follow deleted atoms, and are saved", () => {
  const drawing = formula()
  for (const [op, message] of [
    [{ op: "set_attachment", atom: 8, to: [1] }, /at least two/],
    [{ op: "set_attachment", atom: 8, to: [8, 1] }, /its own candidates/],
    [{ op: "remove_attachment", atom: 1 }, /no variable attachment/],
  ] as Array<[Op, RegExp]>) {
    const outcome = applyOps(drawing, [op])
    assert.ok(!outcome.ok && message.test(outcome.error), JSON.stringify(op))
  }
  const fewer = run(drawing, [{ op: "remove", atoms: [1] }])
  assert.deepEqual(fewer.attachments, [{ atom: 8, to: [2, 3] }])
  const gone = run(fewer, [{ op: "remove", atoms: [2] }])
  assert.equal(gone.attachments, undefined)
  const read = readDocument(toDocument(drawing))
  assert.ok("drawing" in read)
  assert.deepEqual(read.drawing.attachments, [{ atom: 8, to: [1, 2, 3] }])
})

test("a point inside a ring picks that ring's free positions, not the fusion atoms", () => {
  const naphthalene = run(emptyDrawing(), [
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_ring", bond: 1, kind: "benzene", side: 1 },
  ]).molecule
  const firstRing = naphthalene.atoms.filter((atom) => atom.id <= 6)
  const middle = { x: firstRing.reduce((sum, atom) => sum + atom.x, 0) / 6, y: firstRing.reduce((sum, atom) => sum + atom.y, 0) / 6 }
  const positions = ringPositionsAt(naphthalene, middle)
  assert.equal(positions?.length, 4)
  assert.equal(ringPositionsAt(naphthalene, { x: 900, y: 900 }), null)
})
