import assert from "node:assert/strict"
import test from "node:test"
import { emptyDrawing } from "@structura/core/drawing"
import { applyOps } from "@structura/core/ops"
import { doubleClickAction } from "@structura/engine"

test("double clicks act as in ChemDraw: a bond selects its molecule, an atom edits its label", () => {
  const built = applyOps(emptyDrawing(), [
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "place_atom", el: "O", at: { x: 400, y: 0 } },
  ])
  assert.ok(built.ok)
  const mol = built.drawing.molecule
  const ring = mol.atoms.filter((atom) => atom.el === "C").map((atom) => atom.id)
  const oxygen = mol.atoms.find((atom) => atom.el === "O")!.id

  const selected = doubleClickAction(mol, { type: "bond", id: mol.bonds[0].id })
  assert.ok(selected?.kind === "select")
  assert.deepEqual([...selected.selection.atoms].sort((a, b) => a - b), ring, "only the clicked molecule")
  assert.equal(selected.selection.bonds.length, 6)

  assert.deepEqual(doubleClickAction(mol, { type: "atom", id: oxygen }), { kind: "label", atom: oxygen })
  assert.equal(doubleClickAction(mol, null), null)
  assert.equal(doubleClickAction(mol, { type: "atom", id: 999 }), null)
})
