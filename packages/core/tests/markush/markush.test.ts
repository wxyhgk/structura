import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "@structura/core/drawing"
import { isVariableName } from "@structura/core/markush"
import { applyOps } from "@structura/core/ops"
import type { Drawing } from "@structura/core/types"
import { label, run } from "@structura/testkit"

/** Cyclopentane with X in the ring at atom 1 and placeholders R1, R2 hanging off atoms 3 and 4. */
function scaffold(): Drawing {
  return run(emptyDrawing(), [
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "cyclopentane" },
    { op: "label", atom: 1, text: "X" },
    { op: "add_atom", el: "C", to: 3, as: "r1" },
    { op: "label", atom: "r1", text: "R1" },
    { op: "add_atom", el: "C", to: 4, as: "r2" },
    { op: "label", atom: "r2", text: "R2" },
  ])
}

test("a label alternative must be an element or a known abbreviation", () => {
  for (const text of ["C1-C30", "alkyl", "R5"]) {
    const result = applyOps(scaffold(), [{ op: "set_variable", name: "R1", alternatives: [label(text)] }])
    assert.ok(!result.ok && /not an element or a known abbreviation/.test(result.error), text)
  }
  for (const text of ["H", "D", "Cl", "CN", "Me", "Ph", "OMe", "13C"]) {
    assert.ok(applyOps(scaffold(), [{ op: "set_variable", name: "R1", alternatives: [label(text)] }]).ok, text)
  }
})

test("L, ETU and Ar1 are variable names; elements and abbreviations are not", () => {
  for (const name of ["R", "R12", "R'", "X", "L", "ETU", "Ar", "Ar1", "Ar2", "Ar'", "Ar''"]) assert.ok(isVariableName(name), name)
  for (const name of ["Me", "Ph", "Cl", "Y", "Kr", "D", "OMe"]) assert.ok(!isVariableName(name), name)
})

