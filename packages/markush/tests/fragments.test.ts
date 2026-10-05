import assert from "node:assert/strict"
import test from "node:test"
import { BOND_LENGTH } from "@structura/core/constants"
import { emptyDrawing } from "@structura/core/drawing"
import { plainFormula } from "@structura/core/formula"
import { enumerate, pickFields } from "../src/enumerate.ts"
import { fragmentFrom, fragmentProblem, fragmentVariables } from "@structura/core/markush"
import { applyOps, type Op } from "@structura/core/ops"
import type { Alternative, Molecule } from "@structura/core/types"
import { validate } from "@structura/core/validate"
import { run } from "@structura/testkit"
import { chemistry } from "@structura/testkit/chem"

const { canonical } = await chemistry()

const label = (text: string): Alternative => ({ kind: "label", text })
const piece = (ops: Op[]): Alternative => ({ kind: "fragment", molecule: run(emptyDrawing(), ops).molecule })

/** Piperidin-1-yl: a cyclohexane with N at atom 1 and the "*" on N. */
const piperidinyl = () =>
  piece([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "cyclohexane" },
    { op: "label", atom: 1, text: "N" },
    { op: "add_atom", el: "C", to: 1, as: "star" },
    { op: "label", atom: "star", text: "*" },
  ])

/** p-Phenylene: benzene with a "*" on atoms 1 and 4. */
const phenylene = () =>
  piece([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 1, as: "a" },
    { op: "label", atom: "a", text: "*" },
    { op: "add_atom", el: "C", to: 4, as: "b" },
    { op: "label", atom: "b", text: "*" },
  ])

/** N–R5 standing in a ring: an N with R5 on it and both "*" on the N. */
const nR5 = () =>
  piece([
    { op: "place_atom", el: "N", at: { x: 0, y: 0 } },
    { op: "add_atom", el: "C", to: 1, as: "r" },
    { op: "label", atom: "r", text: "R5" },
    { op: "add_atom", el: "C", to: 1, as: "a" },
    { op: "label", atom: "a", text: "*" },
    { op: "add_atom", el: "C", to: 1, as: "b" },
    { op: "label", atom: "b", text: "*" },
  ])

/** Drawn tidily: bonds near their length, no two atoms on top of each other, no "*" left, valences kept. */
function assertTidy(mol: Molecule) {
  assert.ok(!mol.atoms.some((atom) => atom.alias === "*"), "no * left")
  assert.deepEqual(validate(mol).filter((problem) => problem.code === "valence"), [])
  const at = new Map(mol.atoms.map((atom) => [atom.id, atom]))
  for (const bond of mol.bonds) {
    const length = Math.hypot(at.get(bond.a)!.x - at.get(bond.b)!.x, at.get(bond.a)!.y - at.get(bond.b)!.y)
    assert.ok(length > BOND_LENGTH * 0.7 && length < BOND_LENGTH * 1.4, `bond ${bond.a}-${bond.b} is ${length.toFixed(1)} long`)
  }
  for (const [i, a] of mol.atoms.entries()) {
    for (const b of mol.atoms.slice(i + 1)) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > BOND_LENGTH * 0.45, `atoms ${a.id} and ${b.id} overlap`)
  }
}

test("a piece needs one or two single-bonded * marks and must hang together", () => {
  assert.equal(fragmentProblem((piperidinyl() as { molecule: Molecule }).molecule), null)
  assert.match(fragmentProblem(run(emptyDrawing(), [{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }]).molecule)!, /\*/)
  const loose = run(emptyDrawing(), [
    { op: "place_atom", el: "C", at: { x: 0, y: 0 } },
    { op: "add_atom", el: "C", to: 1, as: "s" },
    { op: "label", atom: "s", text: "*" },
    { op: "place_atom", el: "O", at: { x: 300, y: 0 } },
  ]).molecule
  assert.match(fragmentProblem(loose)!, /one piece/)
})

test("a piece stands for a substituent: piperidin-1-yl on benzene", () => {
  const drawing = run(emptyDrawing(), [
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 1, as: "r" },
    { op: "label", atom: "r", text: "R1" },
    { op: "set_variable", name: "R1", alternatives: [label("Cl"), piperidinyl()] },
  ])
  const result = enumerate(drawing)
  assert.deepEqual(result.molecules.map((mol) => plainFormula(mol)), ["C6H5Cl", "C11H15N"])
  assertTidy(result.molecules[1])
  assert.equal(pickFields(result.picks[1]).R1, "C5H10N")
})

test("a piece stands in a ring for X, and the variable inside it is expanded too", () => {
  // Pyrrole-like five-membered ring with X at atom 1.
  const drawing = run(emptyDrawing(), [
    { op: "add_ring", at: { x: 0, y: 0 }, size: 5 },
    { op: "label", atom: 1, text: "X" },
    { op: "set_variable", name: "X", alternatives: [label("O"), nR5()] },
    { op: "set_variable", name: "R5", alternatives: [label("H"), label("Me"), label("Ph")] },
  ])
  const result = enumerate(drawing)
  assert.deepEqual(result.molecules.map((mol) => plainFormula(mol)), ["C4H8O", "C4H9N", "C5H11N", "C10H13N"])
  for (const mol of result.molecules) assertTidy(mol)
  assert.deepEqual(pickFields(result.picks[3]), { X: "C6H5N", R5: "Ph" })
  // The substituent on N points out of the ring, not into it.
  const ringed = result.molecules[2]
  const ring = ringed.atoms.filter((atom) => atom.el === "C" && ringed.bonds.filter((bond) => bond.a === atom.id || bond.b === atom.id).length === 2)
  const centre = { x: ring.reduce((sum, atom) => sum + atom.x, 0) / ring.length, y: ring.reduce((sum, atom) => sum + atom.y, 0) / ring.length }
  const n = ringed.atoms.find((atom) => atom.el === "N")!
  const methyl = ringed.atoms.find((atom) => atom.el === "C" && ringed.bonds.some((bond) => (bond.a === atom.id && bond.b === n.id) || (bond.b === atom.id && bond.a === n.id)) && !ring.includes(atom))!
  assert.ok(Math.hypot(methyl.x - centre.x, methyl.y - centre.y) > Math.hypot(n.x - centre.x, n.y - centre.y))
})

test("a two-ended piece links two atoms: Ph–L–Ph with L = p-phenylene is terphenyl", () => {
  const drawing = run(emptyDrawing(), [
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 1, as: "l" },
    { op: "label", atom: "l", text: "L" },
    { op: "add_atom", el: "C", to: "l", as: "ph" },
    { op: "label", atom: "ph", text: "Ph" },
    { op: "set_variable", name: "L", alternatives: [{ kind: "bond" }, phenylene()] },
  ])
  const result = enumerate(drawing)
  assert.deepEqual(result.molecules.map((mol) => plainFormula(mol)), ["C12H10", "C18H14"])
  // p-Phenylene makes p-terphenyl: the two outer rings opposite each other, not meta.
  assert.deepEqual(result.molecules.map(canonical), [canonical("c1ccc(-c2ccccc2)cc1"), canonical("c1ccc(-c2ccc(-c3ccccc3)cc2)cc1")])
  assertTidy(result.molecules[1])
})

test("a piece goes only where its * marks match: a two-ended piece is no substituent", () => {
  const drawing = run(emptyDrawing(), [
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 1, as: "r" },
    { op: "label", atom: "r", text: "R1" },
    { op: "set_variable", name: "R1", alternatives: [label("Me"), phenylene()] },
  ])
  const result = enumerate(drawing)
  assert.equal(result.molecules.length, 1)
  assert.equal(result.misfits.R1?.[0]?.kind, "fragment")
})

test("a variable cannot contain itself through its pieces", () => {
  const loop = applyOps(emptyDrawing(), [
    { op: "set_variable", name: "R5", alternatives: [label("H")] },
    { op: "set_variable", name: "X", alternatives: [nR5()] },
    { op: "set_variable", name: "R5", alternatives: [label("H"), { kind: "fragment", molecule: (nR5() as { molecule: Molecule }).molecule }] },
  ])
  assert.equal(loop.ok, false)
  assert.match(loop.ok ? "" : loop.error, /contain itself/)
})

test("selected atoms become a piece of their own, renumbered and centred", () => {
  const drawing = run(emptyDrawing(), [
    { op: "place_atom", el: "C", at: { x: 500, y: 300 } },
    { op: "add_ring", at: { x: 900, y: 300 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 2, as: "s" },
    { op: "label", atom: "s", text: "*" },
  ])
  const ids = drawing.molecule.atoms.filter((atom) => atom.id !== 1).map((atom) => atom.id)
  const made = fragmentFrom(drawing.molecule, ids)
  assert.deepEqual(made.atoms.map((atom) => atom.id), [1, 2, 3, 4, 5, 6, 7])
  assert.equal(fragmentProblem(made), null)
  assert.ok(Math.abs(made.atoms.reduce((sum, atom) => sum + atom.x, 0) / 7) < BOND_LENGTH)
  assert.deepEqual(fragmentVariables(made), [])
})

test("a formula with drawn pieces survives a save and an open", async () => {
  const { readDocument, toDocument } = await import("@structura/core/document")
  const drawing = run(emptyDrawing(), [
    { op: "add_ring", at: { x: 0, y: 0 }, size: 5 },
    { op: "label", atom: 1, text: "X" },
    { op: "set_variable", name: "R5", alternatives: [label("Me")] },
    { op: "set_variable", name: "X", alternatives: [label("O"), nR5()] },
  ])
  const read = readDocument(toDocument(drawing))
  assert.ok("drawing" in read, "error" in read ? read.error : "")
  assert.deepEqual(read.drawing.variables, JSON.parse(JSON.stringify(drawing.variables)))
  assert.deepEqual(enumerate(read.drawing).molecules.length, 2)
})
