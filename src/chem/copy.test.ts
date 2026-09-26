import assert from "node:assert/strict"
import test from "node:test"
import { plainFormula } from "./formula.ts"
import { setAtomLabel } from "./label.ts"
import { createBondAt, duplicateAtoms, emptyMolecule, sprout, subMolecule } from "./molecule.ts"
import { toMolfile } from "./molfile.ts"
import { readMolfile } from "./sdf.ts"
import { validate } from "./validate.ts"

const SINGLE = { order: 1 as const, stereo: "none" as const }

function propylPhenyl() {
  let mol = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  mol = sprout(mol, mol.atoms[1].id, SINGLE)
  return setAtomLabel(mol, mol.atoms[2].id, "Ph")
}

test("copying takes the selected atoms, the bonds between them and whole groups only", () => {
  const mol = propylPhenyl()
  const ring = mol.groups[0].atoms
  const piece = subMolecule(mol, ring)
  assert.equal(piece.atoms.length, 6)
  assert.equal(piece.bonds.length, 6, "the bond to the chain stays behind")
  assert.equal(piece.groups.length, 1)
  assert.equal(subMolecule(mol, ring.slice(0, 3)).groups.length, 0, "half a group is not a group")
  assert.deepEqual(validate(piece), [])
})

test("what is copied pastes back as the same structure", () => {
  const mol = propylPhenyl()
  const back = readMolfile(toMolfile(subMolecule(mol, mol.atoms.map((atom) => atom.id))))
  assert.equal(plainFormula(back.mol), plainFormula(mol))
})

test("duplicating puts a copy beside the original with fresh ids", () => {
  const mol = propylPhenyl()
  const ids = mol.atoms.map((atom) => atom.id)
  const copy = duplicateAtoms(mol, ids)
  assert.equal(copy.mol.atoms.length, mol.atoms.length * 2)
  assert.equal(copy.mol.groups.length, 2)
  assert.ok(copy.ids.every((id) => !ids.includes(id)))
  const right = Math.max(...mol.atoms.map((atom) => atom.x))
  assert.ok(copy.mol.atoms.filter((atom) => copy.ids.includes(atom.id)).every((atom) => atom.x > right))
  assert.deepEqual(validate(copy.mol), [])
  assert.deepEqual(duplicateAtoms(mol, []), { mol, ids: [] })
})
