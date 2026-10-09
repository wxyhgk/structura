import assert from "node:assert/strict"
import test from "node:test"
import { compoundFields, enumerate, enumerationFields, enumerationSdf } from "@structura/markush"
import { build, label } from "@structura/testkit"

/** R1 on benzene and R1 on cyclohexane: two formulas, R1 = Cl or F. */
const twoFormulas = () =>
  build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene", as: "a" },
    { op: "add_atom", el: "C", to: "a", as: "r" },
    { op: "label", atom: "r", text: "R1" },
    { op: "add_ring", at: { x: 400, y: 0 }, kind: "cyclohexane", as: "b" },
    { op: "add_atom", el: "C", to: "b", as: "s" },
    { op: "label", atom: "s", text: "R1" },
    { op: "set_variable", name: "R1", alternatives: [label("Cl"), label("F")] },
  ])

/** R1 on benzene alone. */
const oneFormula = () =>
  build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene", as: "a" },
    { op: "add_atom", el: "C", to: "a", as: "r" },
    { op: "label", atom: "r", text: "R1" },
    { op: "set_variable", name: "R1", alternatives: [label("Cl"), label("F")] },
  ])

test("a compound's fields lead with its formula when it has one, then each variable", () => {
  const picks = enumerate(oneFormula()).picks[0]
  assert.deepEqual(Object.keys(compoundFields(picks, 2)), ["Formula No", "R1"])
  assert.deepEqual(compoundFields(picks), { R1: "Cl" })
})

test("with several formulas every record says which it came from; with one, none does", () => {
  assert.deepEqual(enumerationFields(enumerate(twoFormulas())), [
    { "Formula No": "1", R1: "Cl" },
    { "Formula No": "1", R1: "F" },
    { "Formula No": "2", R1: "Cl" },
    { "Formula No": "2", R1: "F" },
  ])
  assert.deepEqual(enumerationFields(enumerate(oneFormula())), [{ R1: "Cl" }, { R1: "F" }])
})

test("the SD file carries the same data items, one record per compound", () => {
  const sdf = enumerationSdf(enumerate(twoFormulas()))
  assert.equal(sdf.split("$$$$").length - 1, 4)
  assert.equal(sdf.match(/<Formula No>/g)?.length, 4)
  assert.equal(sdf.match(/<R1>/g)?.length, 4)
})
