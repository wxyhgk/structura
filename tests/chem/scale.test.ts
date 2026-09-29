import assert from "node:assert/strict"
import test from "node:test"
import { BOND_LENGTH } from "../../src/chem/constants.ts"
import { dist } from "../../src/chem/geometry.ts"
import {
  addAtom,
  addBond,
  atomById,
  attachChairAt,
  attachRingAt,
  bondLengthAt,
  chainPoints,
  createBondAt,
  emptyMolecule,
  growRing,
  insertGroup,
  scaleAtoms,
  sprout,
} from "../../src/chem/molecule.ts"
import { RECIPES } from "../../src/chem/molecule/recipes.ts"
import { templateFor } from "../../src/chem/templates.ts"
import type { Molecule } from "../../src/chem/types.ts"

const SINGLE = { order: 1 as const, stereo: "none" as const }

/** A three-carbon chain blown up to twice the normal bond length. */
function bigPropane(): Molecule {
  let mol = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  mol = sprout(mol, mol.atoms[1].id, SINGLE)
  return scaleAtoms(mol, mol.atoms.map((atom) => atom.id), { x: 0, y: 0 }, 2, 2)
}

/** Lengths of the bonds that did not exist in `before`. */
function newBonds(before: Molecule, after: Molecule): number[] {
  const old = new Set(before.bonds.map((bond) => bond.id))
  return after.bonds
    .filter((bond) => !old.has(bond.id))
    .map((bond) => dist(atomById(after, bond.a)!, atomById(after, bond.b)!))
}

function allNear(lengths: number[], target: number, label: string) {
  assert.ok(lengths.length > 0, `${label}: nothing was added`)
  for (const length of lengths) assert.ok(Math.abs(length - target) < target * 0.06, `${label}: ${length.toFixed(1)} vs ${target}`)
}

test("the local bond length follows a scaled structure", () => {
  const big = bigPropane()
  assert.ok(Math.abs(bondLengthAt(big, big.atoms[0].id) - 80) < 0.01)
  assert.equal(bondLengthAt(emptyMolecule()), BOND_LENGTH)
})

test("everything added to a scaled structure matches its bonds", () => {
  const big = bigPropane()
  const [end, middle] = [big.atoms[2].id, big.atoms[1].id]
  allNear(newBonds(big, sprout(big, end, SINGLE)), 80, "new bond")
  allNear(newBonds(big, growRing(big, middle, "cyclopentane").mol), 80, "spiro five-ring")
  allNear(newBonds(big, growRing(big, end, "cyclohexane").mol), 80, "ring on an end")
  allNear(newBonds(big, attachRingAt(big, end, "benzene").mol), 80, "attached ring")
  // A chair is drawn in perspective, with some bonds longer than others; each doubles.
  let normal = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  normal = sprout(normal, normal.atoms[1].id, SINGLE)
  const chairBig = newBonds(big, attachChairAt(big, end, 1).mol).sort((a, b) => a - b)
  const chairNormal = newBonds(normal, attachChairAt(normal, normal.atoms[2].id, 1).mol).sort((a, b) => a - b)
  chairBig.forEach((length, index) => assert.ok(Math.abs(length - 2 * chairNormal[index]) < 0.5, `chair bond ${index}`))
  allNear(newBonds(big, insertGroup(big, end, templateFor("Ph")!)!.mol), 80, "phenyl group")
  allNear(newBonds(big, RECIPES["tert-butyl"](big, end).mol), 80, "tert-butyl")
  const chain = chainPoints({ x: 0, y: 0 }, 0, 3, 80)
  for (let index = 1; index < chain.length; index++) assert.ok(Math.abs(dist(chain[index - 1], chain[index]) - 80) < 0.01)
})

test("a structure at the normal size still gets normal bonds", () => {
  const mol = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  allNear(newBonds(mol, growRing(mol, mol.atoms[1].id, "cyclopentane").mol), BOND_LENGTH, "ring")
})

test("each piece of the drawing keeps its own scale", () => {
  const big = bigPropane()
  const small = createBondAt(big, { x: 500, y: 0 }, SINGLE)
  const tip = small.atoms[small.atoms.length - 1].id
  allNear(newBonds(small, sprout(small, tip, SINGLE)), 80, "second piece picks the drawing's bond length when new")
  let mixed = big
  const a = addAtom(mixed, "C", 500, 0)
  mixed = a.mol
  const b = addAtom(mixed, "C", 540, 0)
  mixed = addBond(b.mol, a.id, b.id, SINGLE)!.mol
  allNear(newBonds(mixed, sprout(mixed, b.id, SINGLE)), BOND_LENGTH, "normal piece next to a big one")
})

test("one stretched bond does not change the scale", () => {
  let mol = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  mol = sprout(mol, mol.atoms[1].id, SINGLE)
  mol = sprout(mol, mol.atoms[2].id, SINGLE)
  const far = addAtom(mol, "C", 400, 0)
  mol = addBond(far.mol, mol.atoms[0].id, far.id, SINGLE)!.mol
  assert.ok(Math.abs(bondLengthAt(mol, far.id) - BOND_LENGTH) < 1)
})
