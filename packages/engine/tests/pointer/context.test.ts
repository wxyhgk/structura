import assert from "node:assert/strict"
import test from "node:test"
import { contextTarget } from "@structura/engine"
import { build } from "@structura/testkit"

const mol = build([{ op: "draw_bond", start: { x: 0, y: 0 } }, { op: "add_atom", el: "C", to: 2 }]).molecule

test("a right-click acts on the selection when it lands on it, else on what it lands on", () => {
  const selection = { atoms: [1, 2], bonds: [1] }
  assert.deepEqual(contextTarget(mol, selection, { type: "atom", id: 1 }), { kind: "selection" })
  assert.deepEqual(contextTarget(mol, selection, { type: "bond", id: 1 }), { kind: "selection" })
  // Outside the selection: that atom or bond alone.
  assert.deepEqual(contextTarget(mol, selection, { type: "atom", id: 3 }), { kind: "atom", id: 3 })
  assert.deepEqual(contextTarget(mol, selection, { type: "bond", id: 2 }), { kind: "bond", id: 2 })
  // A single selected atom is still "that atom", with its own menu.
  assert.deepEqual(contextTarget(mol, { atoms: [1], bonds: [] }, { type: "atom", id: 1 }), { kind: "atom", id: 1 })
  assert.deepEqual(contextTarget(mol, selection, null), { kind: "canvas" })
})
