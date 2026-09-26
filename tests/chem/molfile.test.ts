import assert from "node:assert/strict"
import test from "node:test"
import { addAtom, addBond, bondById, bumpCharge, createBondAt, emptyMolecule, sprout } from "../../src/chem/molecule.ts"
import { plainFormula } from "../../src/chem/formula.ts"
import { setAtomLabel } from "../../src/chem/label.ts"
import { toMolfile } from "../../src/chem/molfile.ts"
import { readMolfile } from "../../src/chem/sdf.ts"
import type { Molecule } from "../../src/chem/types.ts"

const SINGLE = { order: 1 as const, stereo: "none" as const }

function acetate(): Molecule {
  let mol = emptyMolecule()
  const methyl = addAtom(mol, "C", 0, 0)
  mol = methyl.mol
  const carbonyl = addAtom(mol, "C", 34.64, -20)
  mol = carbonyl.mol
  const oxo = addAtom(mol, "O", 34.64, -60)
  mol = oxo.mol
  const oxide = addAtom(mol, "O", 69.28, 0, -1)
  mol = oxide.mol
  mol = addBond(mol, methyl.id, carbonyl.id, SINGLE)!.mol
  mol = addBond(mol, carbonyl.id, oxo.id, { order: 2, stereo: "none" })!.mol
  return addBond(mol, carbonyl.id, oxide.id, SINGLE)!.mol
}

// Checked by reading it back with RDKit: CC(=O)[O-], flagged 2D.
const ACETATE = `acetate
  Structur          2D

  4  3  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.2990    0.7500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.2990    2.2500    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
    2.5980    0.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  2  3  2  0  0  0  0
  2  4  1  0  0  0  0
M  CHG  1   4  -1
M  END
`

test("acetate is written exactly as expected", () => {
  assert.equal(toMolfile(acetate(), "acetate"), ACETATE)
})

test("every atom line has the full V2000 width", () => {
  const lines = toMolfile(acetate()).split("\n")
  for (const line of lines.slice(4, 8)) assert.equal(line.length, 69)
})

test("charges beyond eight atoms spill onto a second M  CHG line", () => {
  let mol = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  for (let index = 0; index < 8; index++) mol = sprout(mol, mol.atoms[mol.atoms.length - 1].id, SINGLE)
  mol = bumpCharge(mol, mol.atoms.map((atom) => atom.id), 1)
  mol = bumpCharge(mol, [mol.atoms[1].id], -3)
  const lines = toMolfile(mol).split("\n").filter((line) => line.startsWith("M  CHG"))
  assert.deepEqual(lines, [
    "M  CHG  8   1   1   2  -2   3   1   4   1   5   1   6   1   7   1   8   1",
    "M  CHG  2   9   1  10   1",
  ])
})

test("wedges are written with their MDL stereo codes and start at a", () => {
  let mol = createBondAt(emptyMolecule(), { x: 0, y: 0 }, { order: 1, stereo: "up" })
  const center = mol.atoms[0].id
  mol = sprout(mol, center, { order: 1, stereo: "down" })
  mol = sprout(mol, center, { order: 1, stereo: "either" })
  mol = sprout(mol, center, { order: 1, stereo: "none", look: "bold" })
  const bonds = toMolfile(mol)
    .split("\n")
    .filter((line) => /^\s+\d+\s+\d+\s+\d\s+\d+  0  0  0$/.test(line))
  assert.deepEqual(bonds.map((line) => line.slice(0, 12)), ["  1  2  1  1", "  1  3  1  6", "  1  4  1  4", "  1  5  1  0"])
})

test("redrawing a bond as a wedge starts it where the drag started", () => {
  let mol = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  const [first, second] = mol.atoms
  const plain = mol.bonds[0]
  assert.equal(plain.a, first.id)
  const wedged = addBond(mol, second.id, first.id, { order: 1, stereo: "up" })
  assert.ok(wedged)
  mol = wedged.mol
  const bond = bondById(mol, plain.id)
  assert.equal(bond?.a, second.id)
  assert.equal(bond?.b, first.id)
  assert.equal(mol.bonds.length, 1)

  const cleared = addBond(mol, first.id, second.id, SINGLE)
  assert.equal(bondById(cleared!.mol, plain.id)?.a, second.id)
})

test("labels are written as placeholders, never as the carbon they sit on", () => {
  let mol = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  mol = sprout(mol, mol.atoms[1].id, SINGLE)
  mol = setAtomLabel(mol, mol.atoms[2].id, "R2")
  mol = sprout(mol, mol.atoms[0].id, SINGLE)
  mol = setAtomLabel(mol, mol.atoms[3].id, "Xyz")
  assert.equal(plainFormula(mol), "C2H4", "placeholders are not counted as atoms")

  const text = toMolfile(mol)
  const atomLines = text.split("\n").slice(4, 8)
  assert.match(atomLines[2], / R# /)
  assert.match(atomLines[3], / \* /)
  assert.match(text, /^A {4}3\nR2$/m)
  assert.match(text, /^A {4}4\nXyz$/m)
  assert.match(text, /^M {2}RGP {2}1 {3}3 {3}2$/m)

  const read = readMolfile(text)
  assert.deepEqual(read.mol.atoms.map((atom) => atom.alias ?? null), [null, null, "R2", "Xyz"])
  assert.equal(toMolfile(read.mol), text)
})

test("an R# atom from another program gets its group number as the label", () => {
  const text = toMolfile(createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE))
    .replace(/ C   0(.*)\n(\s+\S+\s+\S+\s+\S+) C   0/, " C   0$1\n$2 R#  0")
    .replace("M  END", "M  RGP  1   2   5\nM  END")
  assert.equal(readMolfile(text).mol.atoms[1].alias, "R5")
})

test("metals state their valence so readers add no hydrogens we did not draw", () => {
  const tin = addAtom(emptyMolecule(), "Sn", 0, 0)
  let mol = tin.mol
  for (let index = 0; index < 3; index++) mol = sprout(mol, tin.id, SINGLE)
  mol = addAtom(mol, "Na", 200, 0).mol
  const lines = toMolfile(mol).split("\n").slice(4, 4 + mol.atoms.length)
  const valence = (line: string) => line.slice(48, 51).trim()
  assert.equal(valence(lines[0]), "3", "Sn with three bonds")
  assert.equal(valence(lines[1]), "0", "carbon is left to the reader")
  assert.equal(valence(lines[4]), "15", "lone Na has zero valence")
})
