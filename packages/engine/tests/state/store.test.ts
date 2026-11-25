import assert from "node:assert/strict"
import test from "node:test"
import { createEditorStore } from "@structura/engine"

test("an edit that changes nothing is no undo step", () => {
  const store = createEditorStore()
  assert.ok(store.run([{ op: "draw_bond", start: { x: 0, y: 0 } }]))
  const history = store.get().history
  assert.equal(history.past.length, 1)
  for (const ops of [[], [{ op: "move" as const, atoms: [1], dx: 0, dy: 0 }]]) {
    assert.ok(store.run(ops), JSON.stringify(ops))
    assert.equal(store.get().history, history, JSON.stringify(ops))
  }
  // One undo takes the bond away, as it should.
  store.undo()
  assert.equal(store.get().history.present.molecule.atoms.length, 0)
})
