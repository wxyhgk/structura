import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "@structura/core"
import type { Op } from "@structura/core/ops"
import type { Drawing } from "@structura/core/types"
import { run } from "@structura/testkit"
import { captureOps, sketchedPiece, toggleEndOps } from "@structura/engine"
import { fragmentEnds } from "@structura/markush"

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

/** What is drawn in the sketch pad: a methoxy, O then C, no mark yet. */
function methoxy(): Drawing {
  return run(emptyDrawing(), [
    { op: "place_atom", el: "O", at: { x: 0, y: 0 } },
    { op: "add_atom", el: "C", to: 1 },
  ])
}

test("a piece drawn in the sketch pad with no mark joins by the first atom drawn", () => {
  const result = sketchedPiece(methoxy().molecule)
  assert.ok("piece" in result, "problem" in result ? result.problem : "")
  const [end] = fragmentEnds(result.piece)
  assert.equal(result.piece.atoms.find((atom) => atom.id === end.head)?.el, "O")
})

test("clicking an atom in attachment mode marks it, and clicking the mark takes it away", () => {
  const drawn = methoxy()
  const marked = run(drawn, toggleEndOps(drawn.molecule, 2))
  const result = sketchedPiece(marked.molecule)
  assert.ok("piece" in result)
  const [end] = fragmentEnds(result.piece)
  assert.equal(result.piece.atoms.find((atom) => atom.id === end.head)?.el, "C", "joins by the carbon now")
  const star = marked.molecule.atoms.find((atom) => atom.alias === "*")!
  assert.equal(run(marked, toggleEndOps(marked.molecule, star.id)).molecule.atoms.length, 2, "clicking the mark unmarks")
  // A ring atom (X = N–R5) joins by two bonds: a second click on it adds a second mark.
  const twice = run(marked, toggleEndOps(marked.molecule, 2))
  assert.equal(twice.molecule.atoms.filter((atom) => atom.alias === "*").length, 2)
})

test("a linker drawn in the sketch pad needs both ends marked", () => {
  const drawn = methoxy()
  assert.ok("problem" in sketchedPiece(drawn.molecule, { linker: true }))
  const one = run(drawn, toggleEndOps(drawn.molecule, 1))
  assert.ok("problem" in sketchedPiece(one.molecule, { linker: true }))
  const both = run(one, toggleEndOps(one.molecule, 2))
  const result = sketchedPiece(both.molecule, { linker: true })
  assert.ok("piece" in result)
  assert.equal(fragmentEnds(result.piece).length, 2)
})

test("an empty sketch pad says so", () => {
  assert.ok("problem" in sketchedPiece(emptyDrawing().molecule))
})
