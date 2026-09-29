import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { BOND_LENGTH } from "../../src/chem/constants.ts"
import { plainFormula } from "../../src/chem/formula.ts"
import { setAtomLabel } from "../../src/chem/label.ts"
import { addAtom, addBond, bondLengthAt, bumpCharge, createBondAt, emptyMolecule, fuseRingAt, placeRing, sprout } from "../../src/chem/molecule.ts"
import { kekulizeAromaticReport } from "../../src/chem/molecule/kekule.ts"
import { toMolfile } from "../../src/chem/molfile.ts"
import { placeBeside, sideBySide } from "../../src/chem/molecule/arrange.ts"
import { readMolfile, readSdf } from "../../src/chem/sdf.ts"
import type { Molecule } from "../../src/chem/types.ts"
import { validate } from "../../src/chem/validate.ts"

const SINGLE = { order: 1 as const, stereo: "none" as const }
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")

type Expected = {
  name: string
  atoms: number
  bonds: number
  formula: string
  charge: number
  isotopes: number[]
  mode: string
}
const expected: { rdkit: string; records: Expected[] } = JSON.parse(fixture("rdkit-molecules.json"))

/** Element counts, folding D and T into H the way RDKit's formula does, charge dropped. */
function counts(formula: string): Record<string, number> {
  const map: Record<string, number> = {}
  for (const [, el, n] of formula.replace(/[+-]\d*$/, "").matchAll(/([A-Z][a-z]?)(\d*)/g)) {
    const key = el === "D" || el === "T" ? "H" : el
    map[key] = (map[key] ?? 0) + (n ? Number(n) : 1)
  }
  return map
}

test(`SDF written by RDKit ${expected.rdkit} reads the way RDKit reads it`, () => {
  const records = readSdf(fixture("rdkit-molecules.sdf"))
  assert.equal(records.length, expected.records.length)
  records.forEach((record, index) => {
    const want = expected.records[index]
    const label = want.name
    assert.equal(record.title, want.name, label)
    assert.equal(record.mol.atoms.length, want.atoms, label)
    assert.equal(record.mol.bonds.length, want.bonds, label)
    assert.deepEqual(counts(plainFormula(record.mol)), counts(want.formula), label)
    assert.equal(record.mol.atoms.reduce((sum, atom) => sum + atom.charge, 0), want.charge, label)
    assert.deepEqual(record.mol.atoms.flatMap((atom) => (atom.isotope ? [atom.isotope] : [])).sort((a, b) => a - b), want.isotopes, label)
    assert.ok(record.properties.smiles, label)
    const worries = record.problems.filter((problem) => problem.code !== "flattened-3d")
    assert.deepEqual(worries, [], label)
    assert.equal(record.problems.some((problem) => problem.code === "flattened-3d"), want.mode === "3d", label)
  })
})

test("aromatic bond types become alternating single and double bonds", () => {
  const records = readSdf(fixture("rdkit-molecules.sdf"))
  const aromatic = records.find((record) => record.title.startsWith("aromatic"))
  assert.ok(aromatic)
  assert.ok(aromatic.mol.bonds.some((bond) => bond.order === 2))
  assert.deepEqual(validate(aromatic.mol), [])
})

function sampleMolecules(): Array<[string, Molecule]> {
  let acetate = emptyMolecule()
  const c1 = addAtom(acetate, "C", 0, 0)
  acetate = c1.mol
  const c2 = addAtom(acetate, "C", 34.64, -20)
  acetate = c2.mol
  const o1 = addAtom(acetate, "O", 34.64, -60)
  acetate = o1.mol
  const o2 = addAtom(acetate, "O", 69.28, 0, -1)
  acetate = o2.mol
  acetate = addBond(acetate, c1.id, c2.id, SINGLE)!.mol
  acetate = addBond(acetate, c2.id, o1.id, { order: 2, stereo: "none" })!.mol
  acetate = addBond(acetate, c2.id, o2.id, SINGLE)!.mol

  let wedges = createBondAt(emptyMolecule(), { x: 0, y: 0 }, { order: 1, stereo: "up" })
  const center = wedges.atoms[0].id
  wedges = sprout(wedges, center, { order: 1, stereo: "down" }, "Cl")
  wedges = sprout(wedges, center, { order: 1, stereo: "either" }, "Br")

  let charged = createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)
  for (let index = 0; index < 8; index++) charged = sprout(charged, charged.atoms[charged.atoms.length - 1].id, SINGLE)
  charged = bumpCharge(charged, charged.atoms.map((atom) => atom.id), 1)

  const labelled = setAtomLabel(setAtomLabel(createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE), 1, "13C"), 2, "D")
  let naphthalene = placeRing(emptyMolecule(), { x: 0, y: 0 }, "benzene")
  naphthalene = fuseRingAt(naphthalene, naphthalene.bonds[0].id, "benzene", 1).mol
  return [["acetate", acetate], ["wedges", wedges], ["charges", charged], ["isotopes", labelled], ["naphthalene", naphthalene]]
}

test("what we write, we read back unchanged", () => {
  for (const [name, mol] of sampleMolecules()) {
    const text = toMolfile(mol, name)
    const read = readMolfile(text)
    assert.deepEqual(read.problems, [], name)
    assert.equal(toMolfile(read.mol, name), text, name)
    assert.equal(plainFormula(read.mol), plainFormula(mol), name)
  }
})

test("several records sit side by side without overlapping", () => {
  const records = readSdf(fixture("rdkit-molecules.sdf"))
  const merged = sideBySide(records.map((record) => record.mol))
  assert.equal(merged.atoms.length, records.reduce((sum, record) => sum + record.mol.atoms.length, 0))
  assert.deepEqual(validate(merged).filter((problem) => problem.severity === "error"), [])
  let previousRight = -Infinity
  let offset = 0
  for (const record of records) {
    const xs = merged.atoms.slice(offset, offset + record.mol.atoms.length).map((atom) => atom.x)
    offset += record.mol.atoms.length
    assert.ok(Math.min(...xs) > previousRight, record.title)
    previousRight = Math.max(...xs)
  }
})

test("files the editor cannot hold are reported, not guessed at", () => {
  const v3000 = "x\n  y\n\n  0  0  0     0  0            999 V3000\nM  END\n"
  assert.equal(readMolfile(v3000).problems[0]?.code, "bad-molfile")
  const cut = "x\n  y\n\n  3  2  0  0  0  0  0  0  0  0999 V2000\n    0.0000    0.0000    0.0000 C   0  0\n"
  assert.equal(readMolfile(cut).problems[0]?.severity, "error")

  const rgroup = toMolfile(createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)).replace(/ C   0/, " R#  0")
  const read = readMolfile(rgroup)
  assert.equal(read.mol.atoms[0].alias, "R#")
  assert.equal(read.problems[0]?.code, "unsupported-mol-feature")

  const radical = toMolfile(createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE)).replace("M  END", "M  RAD  1   1   2\nM  END")
  assert.ok(readMolfile(radical).problems.some((problem) => problem.message.includes("radical")))
})

test("pasted molecules go to the right of the drawing without moving it", () => {
  const drawn = createBondAt(emptyMolecule(), { x: 100, y: 200 }, SINGLE)
  const [pasted] = readSdf(fixture("rdkit-molecules.sdf"))
  const merged = placeBeside(drawn, [pasted.mol])
  assert.deepEqual(merged.atoms.slice(0, 2), drawn.atoms)
  assert.ok(merged.atoms.slice(2).every((atom) => atom.x > Math.max(...drawn.atoms.map((item) => item.x))))
  assert.ok(merged.atoms.slice(2).every((atom) => atom.id >= drawn.nextAtomId))
  assert.deepEqual(validate(merged).filter((problem) => problem.severity === "error"), [])
  assert.equal(placeBeside(emptyMolecule(), [pasted.mol]).atoms.length, pasted.mol.atoms.length)
})

test("charged aromatic rings read the way RDKit reads them", () => {
  const want: { records: Array<{ name: string; formula: string }> } = JSON.parse(fixture("rdkit-aromatic.json"))
  const records = readSdf(fixture("rdkit-aromatic.sdf"))
  assert.equal(records.length, want.records.length)
  records.forEach((record, index) => {
    const expected = want.records[index]
    assert.equal(record.title, expected.name)
    assert.deepEqual(counts(plainFormula(record.mol)), counts(expected.formula), expected.name)
    const charge = record.mol.atoms.reduce((sum, atom) => sum + atom.charge, 0)
    assert.equal(charge, /\+$/.test(expected.formula) ? 1 : /-$/.test(expected.formula) ? -1 : 0, expected.name)
    assert.deepEqual(record.problems, [], expected.name)
  })
})

/** A ring of `size` carbons with aromatic bonds and one charged carbon. */
function chargedRing(size: number, charge: number): Molecule {
  let mol = placeRing(emptyMolecule(), { x: 0, y: 0 }, size === 7 ? "cycloheptane" : "cyclopentane")
  mol = bumpCharge(mol, [mol.atoms[0].id], charge)
  return { ...mol, bonds: mol.bonds.map((bond) => ({ ...bond, order: 1 as const, aromatic: true })) }
}

test("charged ring carbons keep their double bonds to themselves", () => {
  const tropylium = kekulizeAromaticReport(chargedRing(7, 1))
  assert.equal(tropylium.unresolved, 0)
  assert.equal(plainFormula(tropylium.mol), "C7H7")
  assert.equal(tropylium.mol.bonds.filter((bond) => bond.order === 2).length, 3)
  const anion = kekulizeAromaticReport(chargedRing(5, -1))
  assert.equal(anion.unresolved, 0)
  assert.equal(plainFormula(anion.mol), "C5H5")
})

test("adding a ring elsewhere leaves an existing aromatic ring alone", () => {
  const [pyridinium] = readSdf(fixture("rdkit-aromatic.sdf"))
  const before = plainFormula(pyridinium.mol)
  const withBenzene = placeRing(pyridinium.mol, { x: 400, y: 0 }, "benzene")
  const ids = new Set(pyridinium.mol.atoms.map((atom) => atom.id))
  assert.equal(plainFormula(withBenzene, [...ids]), before)
})

test("imported structures are scaled to the editor's bond length", () => {
  for (const record of readSdf(fixture("rdkit-molecules.sdf"))) {
    if (record.mol.bonds.length === 0) continue
    assert.ok(Math.abs(bondLengthAt(record.mol) - BOND_LENGTH) < 0.01, record.title)
  }
  const ours = toMolfile(createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE))
  const doubled = ours.replace(/^( +)(-?\d+\.\d+)( +)(-?\d+\.\d+)/gm, (_, s1, x, s2, y) => `${s1}${(Number(x) * 2).toFixed(4)}${s2}${(Number(y) * 2).toFixed(4)}`)
  assert.ok(Math.abs(bondLengthAt(readMolfile(doubled).mol) - BOND_LENGTH) < 0.01)
})
