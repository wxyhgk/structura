import assert from "node:assert/strict"
import test from "node:test"
import { BOND_LENGTH } from "@structura/core/constants"
import { emptyDrawing } from "@structura/core/drawing"
import { fragmentFrom, fragmentProblem, fragmentProblemText, fragmentVariables } from "@structura/core/markush"
import { applyOps, type Op } from "@structura/core/ops"
import type { Alternative, Molecule } from "@structura/core/types"
import { run } from "@structura/testkit"

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

test("a piece needs one or two single-bonded * marks and must hang together", () => {
  assert.equal(fragmentProblem((piperidinyl() as { molecule: Molecule }).molecule), null)
  assert.deepEqual(fragmentProblem(run(emptyDrawing(), [{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }]).molecule), { code: "no-star" })
  assert.match(fragmentProblemText(run(emptyDrawing(), [{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }]).molecule)!, /\*/)
  const loose = run(emptyDrawing(), [
    { op: "place_atom", el: "C", at: { x: 0, y: 0 } },
    { op: "add_atom", el: "C", to: 1, as: "s" },
    { op: "label", atom: "s", text: "*" },
    { op: "place_atom", el: "O", at: { x: 300, y: 0 } },
  ]).molecule
  assert.deepEqual(fragmentProblem(loose), { code: "disconnected" })
  assert.match(fragmentProblemText(loose)!, /one piece/)
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

