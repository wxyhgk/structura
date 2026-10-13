import assert from "node:assert/strict"
import test from "node:test"
import { enumerate, formulasOf, librarySize } from "@structura/markush"
import { build, label } from "@structura/testkit"
import { chemistry } from "@structura/testkit/chem"

const { canonical, canonicalAll } = await chemistry()

/** Formula I: R1 on benzene; formula II: R1 on cyclohexane; and plain ethanol beside them. R1 = Cl or F. */
const twoFormulas = () =>
  build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene", as: "a" },
    { op: "add_atom", el: "C", to: "a", as: "r" },
    { op: "label", atom: "r", text: "R1" },
    { op: "add_ring", at: { x: 400, y: 0 }, kind: "cyclohexane", as: "b" },
    { op: "add_atom", el: "C", to: "b", as: "s" },
    { op: "label", atom: "s", text: "R1" },
    { op: "add_atom", el: "C", as: "e1" },
    { op: "move", atoms: ["e1"], dx: 0, dy: 300 },
    { op: "add_atom", el: "C", to: "e1", as: "e2" },
    { op: "add_atom", el: "O", to: "e2" },
    { op: "set_variable", name: "R1", alternatives: [label("Cl"), label("F")] },
  ])

test("two formulas on one drawing are expanded each on its own, never joined; a plain molecule beside them is left out", () => {
  const drawing = twoFormulas()
  assert.equal(formulasOf(drawing).length, 2)
  const result = enumerate(drawing)
  assert.equal(result.formulas, 2)
  assert.deepEqual(result.formulaOf, [1, 1, 2, 2])
  assert.deepEqual(canonicalAll(result.molecules), canonicalAll(["Clc1ccccc1", "Fc1ccccc1", "ClC1CCCCC1", "FC1CCCCC1"]))
  assert.ok(!canonicalAll(result.molecules).some((smiles) => smiles.includes("O")), "the ethanol is in no product")
  assert.equal(librarySize(drawing).combinations, 4)
})

test("the same compound from two formulas is kept once", () => {
  const twice = build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene", as: "a" },
    { op: "add_atom", el: "C", to: "a", as: "r" },
    { op: "label", atom: "r", text: "R1" },
    { op: "add_ring", at: { x: 400, y: 0 }, kind: "benzene", as: "b" },
    { op: "add_atom", el: "C", to: "b", as: "s" },
    { op: "label", atom: "s", text: "R1" },
    { op: "set_variable", name: "R1", alternatives: [label("Cl")] },
  ])
  const result = enumerate(twice, { identity: (mol) => canonical(mol) })
  assert.equal(result.molecules.length, 1)
  assert.equal(result.duplicates, 1)
})

test("a drawing without variables is one formula, itself", () => {
  const plain = build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }])
  assert.equal(formulasOf(plain).length, 1)
  assert.equal(enumerate(plain).molecules.length, 1)
})

/** R1 on a benzoate, with Na⁺ drawn beside it as its own piece; a second formula far to the right, with Cl⁻ beside it. */
const salts = () =>
  build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene", as: "a" },
    { op: "add_atom", el: "C", to: "a", as: "c" },
    { op: "add_atom", el: "O", to: "c", order: 2 },
    { op: "add_atom", el: "O", to: "c", as: "o" },
    { op: "set_charge", atom: "o", charge: -1 },
    { op: "add_atom", el: "Na", as: "na" },
    { op: "move", atoms: ["na"], dx: 140, dy: 0 },
    { op: "set_charge", atom: "na", charge: 1 },
    { op: "add_atom", el: "C", to: 4, as: "r" },
    { op: "label", atom: "r", text: "R1" },
    { op: "add_atom", el: "N", as: "n" },
    { op: "move", atoms: ["n"], dx: 900, dy: 0 },
    { op: "set_charge", atom: "n", charge: 1 },
    { op: "add_atom", el: "C", to: "n", as: "s" },
    { op: "label", atom: "s", text: "R1" },
    { op: "add_atom", el: "Cl", as: "cl" },
    { op: "move", atoms: ["cl"], dx: 1000, dy: 60 },
    { op: "set_charge", atom: "cl", charge: -1 },
    { op: "set_variable", name: "R1", alternatives: [label("H"), label("Me")] },
  ])

test("a counter-ion drawn beside a formula stays with it: every salt keeps its ion, each ion with the nearer formula", () => {
  const drawing = salts()
  assert.equal(formulasOf(drawing).length, 2)
  const result = enumerate(drawing)
  assert.deepEqual(result.formulaOf, [1, 1, 2, 2])
  assert.deepEqual(canonicalAll(result.molecules), canonicalAll(["O=C([O-])c1ccccc1.[Na+]", "Cc1ccc(C(=O)[O-])cc1.[Na+]", "[NH4+].[Cl-]", "C[NH3+].[Cl-]"]))
})

test("an uncharged molecule beside a formula is still no part of it, though an ion is", () => {
  const drawing = twoFormulas()
  assert.ok(!canonicalAll(enumerate(drawing).molecules).some((smiles) => smiles.includes("O")))
})
