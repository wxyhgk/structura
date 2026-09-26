import assert from "node:assert/strict"
import test from "node:test"
import { addReactionArrow, emptyDrawing } from "../../src/chem/drawing.ts"
import { emptyHistory, historyReducer, type History } from "../../src/chem/history.ts"
import { addAtom, createBondAt, emptyMolecule, placeRing } from "../../src/chem/molecule.ts"
import { validateDrawing } from "../../src/chem/validate.ts"

const SINGLE = { order: 1 as const, stereo: "none" as const }

function addCarbon(history: History): { history: History; id: number } {
  const step = addAtom(history.present.molecule, "C", 0, 0)
  return { history: historyReducer(history, { type: "commit-molecule", mol: step.mol }), id: step.id }
}

test("an atom added after undo gets a fresh id", () => {
  const first = addCarbon(emptyHistory())
  const undone = historyReducer(first.history, { type: "undo" })
  assert.equal(undone.present.molecule.atoms.length, 0)
  const second = addCarbon(undone)
  assert.notEqual(second.id, first.id)
})

test("redo keeps the counters that undo carried forward", () => {
  let history = emptyHistory()
  const a = addCarbon(history)
  const b = addCarbon(a.history)
  history = historyReducer(historyReducer(b.history, { type: "undo" }), { type: "undo" })
  history = historyReducer(history, { type: "redo" })
  assert.deepEqual(history.present.molecule.atoms.map((atom) => atom.id), [a.id])
  assert.ok(history.present.molecule.nextAtomId > b.id)
  const c = addCarbon(history)
  assert.ok(c.id !== a.id && c.id !== b.id)
})

test("a new document does not restart the id counters", () => {
  let history = emptyHistory()
  const molecule = createBondAt(history.present.molecule, { x: 0, y: 0 }, SINGLE)
  history = historyReducer(history, { type: "commit-molecule", mol: molecule })
  history = historyReducer(history, {
    type: "commit",
    drawing: addReactionArrow(history.present, molecule.atoms.map((atom) => atom.id), "right"),
  })
  const used = new Set(molecule.atoms.map((atom) => atom.id))
  history = historyReducer(history, { type: "commit", drawing: emptyDrawing() })
  assert.equal(history.present.molecule.atoms.length, 0)
  assert.ok(history.present.nextArrowId > 1)
  const fresh = addCarbon(history)
  assert.ok(!used.has(fresh.id))
})

test("undo and redo walk back and forth without breaking invariants", () => {
  let history = emptyHistory()
  const ids: number[] = []
  for (let index = 0; index < 5; index++) {
    const step = addCarbon(history)
    history = step.history
    ids.push(step.id)
  }
  for (const action of ["undo", "undo", "redo", "undo", "undo", "undo", "redo", "redo"] as const) {
    history = historyReducer(history, { type: action })
    assert.deepEqual(validateDrawing(history.present), [])
  }
  const last = addCarbon(history)
  assert.ok(!ids.includes(last.id))
  assert.equal(new Set(ids).size, ids.length)
})

test("history keeps at most 100 steps", () => {
  let history = emptyHistory()
  for (let index = 0; index < 120; index++) history = addCarbon(history).history
  assert.equal(history.past.length, 100)
})

test("imports merge into the drawing as it is when they land", () => {
  const ethanol = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const benzene = placeRing(emptyMolecule(), { x: 0, y: 0 }, "benzene")
  let history = emptyHistory()
  // Both imports started from the empty drawing; the second must not erase the first.
  history = historyReducer(history, { type: "append", molecules: [ethanol] })
  history = historyReducer(history, { type: "append", molecules: [benzene] })
  assert.equal(history.present.molecule.atoms.length, 8)
  assert.deepEqual(validateDrawing(history.present), [])
  history = historyReducer(history, { type: "undo" })
  assert.equal(history.present.molecule.atoms.length, 2)

  const opened = historyReducer(history, { type: "open", molecules: [benzene] })
  assert.equal(opened.present.molecule.atoms.length, 6)
  assert.ok(opened.present.molecule.atoms.every((atom) => atom.id > 2), "ids continue after those already used")
})
