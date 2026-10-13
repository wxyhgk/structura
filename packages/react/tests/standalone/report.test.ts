import assert from "node:assert/strict"
import test from "node:test"
import { build } from "@structura/testkit"
import { structureProblems } from "../../src/standalone/report.ts"

test("a structure's problems are numbered as its molfile numbers atoms, and said in Chinese", () => {
  // O–H–C: the H with two bonds. Ids no longer match places once an atom is deleted, so delete one first.
  const drawing = build([
    { op: "add_atom", el: "N", as: "gone" },
    { op: "add_atom", el: "O", as: "o" },
    { op: "add_atom", el: "H", to: "o", as: "h" },
    { op: "add_atom", el: "C", to: "h" },
    { op: "remove", atoms: ["gone"] },
  ])
  const [problem, ...rest] = structureProblems(drawing)
  assert.deepEqual(rest, [])
  assert.equal(problem.code, "valence")
  assert.deepEqual(problem.atoms, [2], "the H is the molfile's second atom")
  assert.equal(problem.text, "第 2 个原子（H）超出化合价")
  assert.match(problem.message, /exceeds its valence/)
  assert.deepEqual(structureProblems(build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }])), [])
})
