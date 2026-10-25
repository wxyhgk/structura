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

test("slips in the drawing come back too, as warnings said in Chinese", () => {
  const drawing = build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "cyclohexane" },
    { op: "place_atom", el: "N", at: { x: 300, y: 0 } },
    { op: "add_atom", el: "O", to: 7 },
  ])
  const [first, second, third] = drawing.molecule.atoms
  const moved = (id: number, x: number, y: number) => ({ ...drawing, molecule: { ...drawing.molecule, atoms: drawing.molecule.atoms.map((atom) => (atom.id === id ? { ...atom, x, y } : atom)) } })
  assert.deepEqual(structureProblems(moved(7, first.x + 1, first.y)), [
    { code: "atoms-overlap", severity: "warning", atoms: [1, 7], text: "第 1 个原子（C）和第 7 个原子（N）画在了一起", message: "atoms #1, #7 are drawn on top of each other" },
  ])
  const onBond = structureProblems(moved(8, (second.x + third.x) / 2, (second.y + third.y) / 2))
  assert.deepEqual(onBond.map((problem) => [problem.code, problem.atoms, problem.text]), [["atom-on-bond", [8, 2, 3], "第 8 个原子（O）压在第 2 个原子（C）和第 3 个原子（C）之间的键上"]])
  const long = structureProblems(moved(1, first.x - 300, first.y))
  assert.deepEqual(long.map((problem) => problem.text), ["第 1 个原子（C）和第 2 个原子（C）之间的键比别的键长得多", "第 6 个原子（C）和第 1 个原子（C）之间的键比别的键长得多"])
})
