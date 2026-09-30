import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "../../src/chem/drawing.ts"
import { plainFormula } from "../../src/chem/formula.ts"
import { enumerate } from "../../src/chem/markush/enumerate.ts"
import { undefinedVariables } from "../../src/chem/markush/variables.ts"
import { applyOps, type Op } from "../../src/chem/ops.ts"
import type { Drawing } from "../../src/chem/types.ts"
import { errorsOf, validate } from "../../src/chem/validate.ts"

function run(drawing: Drawing, ops: Op[]): Drawing {
  const result = applyOps(drawing, ops)
  assert.ok(result.ok, result.ok ? "" : `op ${result.index}: ${result.error}`)
  return result.drawing
}

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

const label = (text: string) => ({ kind: "label" as const, text })

test("variables are checked when they are defined, and can be removed", () => {
  const drawing = scaffold()
  const bad: Array<[Op, RegExp]> = [
    [{ op: "set_variable", name: "Me", alternatives: [label("H")] }, /not a variable name/],
    [{ op: "set_variable", name: "R1", alternatives: [] }, /at least one/],
    [{ op: "set_variable", name: "R1", alternatives: [{ kind: "class", class: "wizard" as "alkyl" }] }, /unknown class/],
    [{ op: "set_variable", name: "R1", alternatives: [{ kind: "class", class: "alkyl", min: 30, max: 1 }] }, /above/],
    [{ op: "set_variable", name: "R1", alternatives: [label("  ")] }, /1 to 32/],
  ]
  for (const [op, message] of bad) {
    const result = applyOps(drawing, [op])
    assert.ok(!result.ok && message.test(result.error), JSON.stringify(op))
  }
  const defined = run(drawing, [{ op: "set_variable", name: "R1", alternatives: [label(" H "), { kind: "class", class: "alkyl", min: 1, max: 30 }] }])
  assert.deepEqual(defined.variables?.R1.alternatives[0], { kind: "label", text: "H" }, "labels are trimmed")
  assert.deepEqual(undefinedVariables(defined), ["X", "R2"])
  const removed = run(defined, [{ op: "remove_variable", name: "R1" }])
  assert.equal(removed.variables, undefined)
  assert.ok(!applyOps(removed, [{ op: "remove_variable", name: "R1" }]).ok)
})

function formula() {
  return run(scaffold(), [
    { op: "set_variable", name: "X", alternatives: [label("O"), label("S")] },
    { op: "set_variable", name: "R1", alternatives: [label("H"), label("F"), label("CN"), { kind: "class", class: "alkyl", min: 1, max: 30 }] },
    { op: "set_variable", name: "R2", alternatives: [label("H"), label("Me")] },
  ])
}

test("a generic formula expands into every concrete combination; classes stay out", () => {
  const result = enumerate(formula())
  assert.equal(result.total, 12)
  assert.equal(result.molecules.length, 12)
  assert.deepEqual(result.classesLeftOut, { R1: 1 })
  assert.deepEqual([result.undefinedNames, result.onlyClasses, result.failed], [[], [], 0])
  const formulas = result.molecules.map((mol) => plainFormula(mol))
  assert.equal(formulas[0], "C4H8O", "X = O, R1 = H, R2 = H: tetrahydrofuran")
  assert.ok(formulas.includes("C6H9NS"), "X = S, R1 = CN, R2 = Me")
  assert.equal(new Set(formulas).size, 12, "every combination is different")
  for (const mol of result.molecules) {
    assert.ok(mol.atoms.every((atom) => !atom.alias), "no placeholder is left")
    assert.deepEqual(errorsOf(validate(mol)), [])
  }
})

test("enumeration stops at the limit but still counts every combination", () => {
  const result = enumerate(formula(), 5)
  assert.equal(result.molecules.length, 5)
  assert.equal(result.total, 12)
})

test("a variable with only classes, or none at all, is reported", () => {
  const onlyClasses = run(formula(), [{ op: "set_variable", name: "R2", alternatives: [{ kind: "class", class: "aryl", min: 6, max: 30 }] }])
  const blocked = enumerate(onlyClasses)
  assert.equal(blocked.molecules.length, 0)
  assert.deepEqual(blocked.onlyClasses, ["R2"])
  const missing = run(formula(), [{ op: "remove_variable", name: "R2" }])
  const partial = enumerate(missing)
  assert.equal(partial.molecules.length, 6)
  assert.deepEqual(partial.undefinedNames, ["R2"])
})
