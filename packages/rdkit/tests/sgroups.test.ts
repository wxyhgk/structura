import assert from "node:assert/strict"
import test from "node:test"
import initRDKitModule from "@rdkit/rdkit"
import { toMolfile } from "@structura/core/molfile"
import { readMolfile } from "@structura/core/sdf"
import { build, run } from "@structura/testkit"

const rdkit = await initRDKitModule()

test("RDKit opens a molfile with a repeat unit and its range, and what it writes back keeps the range", () => {
  const chain = build([
    { op: "place_atom", el: "C", at: { x: 0, y: 0 } },
    { op: "add_atom", el: "C", to: 1 },
    { op: "add_atom", el: "O", to: 2 },
    { op: "add_atom", el: "C", to: 3 },
  ])
  const drawing = run(chain, [
    { op: "add_bracket", atoms: [2, 3], kind: "repeat", repeat: { min: 2, max: 5, name: "m" } },
    { op: "add_bracket", atoms: [4], kind: "group" },
  ])
  const text = toMolfile(drawing.molecule, "Structura", drawing.brackets)
  const mol = rdkit.get_mol(text)
  assert.ok(mol && mol.is_valid(), "RDKit parses it")
  try {
    assert.equal(mol.get_smiles(), "CCOC")
    const back = readMolfile(mol.get_molblock())
    assert.deepEqual(back.brackets?.find((bracket) => bracket.kind === "repeat")?.repeat, { min: 2, max: 5, name: "m" })
  } finally {
    mol.delete()
  }
})
