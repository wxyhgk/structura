import assert from "node:assert/strict"
import test from "node:test"
import { contextAtoms } from "@structura/engine"
import { build } from "@structura/testkit"

/** Propane (atoms 1–3, bonds 1–2) and, apart from it, ethane (atoms 4–5, bond 3). */
const mol = build([
  { op: "draw_bond", start: { x: 0, y: 0 } },
  { op: "add_atom", el: "C", to: 2 },
  { op: "draw_bond", start: { x: 500, y: 0 } },
]).molecule

test("a right-click on the selection acts on its atoms, with those of selected bonds", () => {
  assert.deepEqual(contextAtoms(mol, { atoms: [1], bonds: [3] }, { kind: "selection" }).sort(), [1, 4, 5])
})

test("on an atom or bond, the whole molecule it belongs to", () => {
  assert.deepEqual(contextAtoms(mol, { atoms: [], bonds: [] }, { kind: "atom", id: 4 }).sort(), [4, 5])
  assert.deepEqual(contextAtoms(mol, { atoms: [], bonds: [] }, { kind: "bond", id: 2 }).sort(), [1, 2, 3])
  assert.deepEqual(contextAtoms(mol, { atoms: [], bonds: [] }, { kind: "bond", id: 99 }), [])
})

test("on empty canvas, or before any right-click, nothing", () => {
  assert.deepEqual(contextAtoms(mol, { atoms: [1], bonds: [] }, { kind: "canvas" }), [])
  assert.deepEqual(contextAtoms(mol, { atoms: [1], bonds: [] }, null), [])
})
