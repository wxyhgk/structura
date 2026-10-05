import assert from "node:assert/strict"
import test from "node:test"
import { sceneToSvg } from "../src/draw.ts"
import { emptyDrawing } from "../src/drawing.ts"
import { plainFormula } from "../src/formula.ts"
import { atomIdsOfSelection, displayMolecule } from "../src/molecule.ts"
import type { Drawing } from "../src/types.ts"
import { run } from "@structura/testkit"

/** A methyl carbon (atom 1) with Ph typed on a second carbon: toluene, the phenyl kept as a label. */
function toluene(): Drawing {
  return run(emptyDrawing(), [{ op: "add_atom", el: "C", as: "me" }, { op: "add_atom", el: "C", to: "me", as: "ph" }, { op: "label", atom: "ph", text: "Ph" }])
}

test("a kept abbreviation is shown as its label while its atoms stay real", () => {
  const drawing = toluene()
  const mol = drawing.molecule
  assert.equal(mol.groups.length, 1)
  assert.ok(mol.groups[0].collapsed)
  assert.equal(plainFormula(mol), "C7H8", "the chemistry counts every atom")
  const shown = displayMolecule(mol)
  assert.equal(shown.atoms.length, 2, "only the methyl and the label's anchor are shown")
  assert.equal(shown.atoms.find((atom) => atom.id === mol.groups[0].atoms[0])?.alias, "Ph")
  assert.equal(shown.bonds.length, 1)
  const svg = sceneToSvg(mol, false)
  assert.ok(svg.includes(">Ph<"), "exports write the label")
})

test("moving, deleting and copying the label take the whole group along", () => {
  const drawing = toluene()
  const anchor = drawing.molecule.groups[0].atoms[0]
  const before = new Map(drawing.molecule.atoms.map((atom) => [atom.id, atom]))
  const moved = run(drawing, [{ op: "move", atoms: [anchor], dx: 30, dy: 10 }])
  for (const id of drawing.molecule.groups[0].atoms) {
    const atom = moved.molecule.atoms.find((item) => item.id === id)!
    assert.deepEqual([atom.x - before.get(id)!.x, atom.y - before.get(id)!.y], [30, 10])
  }
  assert.equal(atomIdsOfSelection(drawing.molecule, { atoms: [anchor], bonds: [] }).length, 6, "selecting the label selects its group")
  const copied = run(drawing, [{ op: "duplicate", atoms: [anchor] }])
  assert.equal(copied.molecule.atoms.length, 7 + 6)
  assert.equal(copied.molecule.groups.length, 2)
  const removed = run(drawing, [{ op: "remove", atoms: [anchor] }])
  assert.equal(removed.molecule.atoms.length, 1, "no atoms are left behind the deleted label")
})

test("abbreviations expand and collapse, the selected ones or all", () => {
  const drawing = toluene()
  const open = run(drawing, [{ op: "set_collapsed", collapsed: false }])
  assert.equal(open.molecule.groups[0].collapsed, false)
  assert.equal(displayMolecule(open.molecule).atoms.length, 7)
  assert.ok(!sceneToSvg(open.molecule, false).includes(">Ph<"))
  const closed = run(open, [{ op: "set_collapsed", atoms: [open.molecule.groups[0].atoms[3]], collapsed: true }])
  assert.equal(closed.molecule.groups[0].collapsed, true)
  // Atoms not in any group change nothing.
  const methyl = drawing.molecule.atoms[0].id
  assert.equal(run(open, [{ op: "set_collapsed", atoms: [methyl], collapsed: true }]).molecule.groups[0].collapsed, false)
})
