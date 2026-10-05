import assert from "node:assert/strict"
import test from "node:test"
import initRDKitModule from "@rdkit/rdkit"
import { plainFormula } from "@structura/core/formula"
import { usableRecords } from "@structura/core/import"
import { placeholders } from "@structura/markush"
import { toMolfile } from "@structura/core/molfile"
import { readMolfile } from "@structura/core/sdf"
import { looksLikeSmiles, smilesLines, smilesRecords, smilesToMolfile } from "../src/index.ts"

const rdkit = await initRDKitModule()
rdkit.prefer_coordgen(true)

/** RDKit's canonical SMILES, used to compare structures including stereo. */
function canonical(input: string): string {
  const mol = rdkit.get_mol(input)
  assert.ok(mol)
  try {
    return mol.get_smiles()
  } finally {
    mol.delete()
  }
}

const CASES: Array<[string, string]> = [
  ["CC(=O)Oc1ccccc1C(=O)O", "C9H8O4"],
  ["Cn1cnc2c1c(=O)n(C)c(=O)n2C", "C8H10N4O2"],
  ["CC(C)Cc1ccc(cc1)[C@H](C)C(=O)O", "C13H18O2"],
  ["C/C=C/C(=O)O", "C4H6O2"],
  ["[Na+].CC(=O)[O-]", "C2H3NaO2"],
  ["F[B-](F)(F)F", "BF4"],
  ["[2H]C([2H])([2H])O", "CHD3O"],
  ["c1ccc(cc1)N1c2ccccc2B2c3ccccc3N(c3ccccc3)c3cccc1c23", "C30H21BN2"],
  ["c1ccncc1.c1cc[nH]c1", "C9H10N2"],
  ["O=[N+]([O-])c1ccccc1", "C6H5NO2"],
  ["CS(=O)(=O)N", "CH5NO2S"],
]

test(`SMILES go through RDKit ${rdkit.version()} and come back as the same molecule`, () => {
  for (const [smiles, formula] of CASES) {
    const result = smilesToMolfile(rdkit, smiles)
    assert.ok("molfile" in result, smiles)
    const read = readMolfile(result.molfile)
    assert.deepEqual(read.problems, [], smiles)
    assert.equal(plainFormula(read.mol), formula, smiles)
    assert.ok(read.mol.atoms.some((atom) => atom.x !== 0 || atom.y !== 0), `${smiles} has coordinates`)
    assert.equal(canonical(toMolfile(read.mol)), canonical(smiles), `${smiles} keeps its structure and stereo`)
  }
})

test("bad SMILES are reported", () => {
  for (const bad of ["C1CC", "Xx", "C(C", "c1cccc1"]) {
    assert.ok("error" in smilesToMolfile(rdkit, bad), bad)
  }
})

test("SMILES text is split into lines with optional names", () => {
  assert.deepEqual(smilesLines("CCO ethanol\n\n# comment\nc1ccccc1  benzene ring\n"), [
    { smiles: "CCO", name: "ethanol" },
    { smiles: "c1ccccc1", name: "benzene ring" },
  ])
  assert.equal(looksLikeSmiles("CC(=O)O\n[Na+].[Cl-]"), true)
  assert.equal(looksLikeSmiles("hello, world"), false)
  assert.equal(looksLikeSmiles("  M  END"), false)
  assert.equal(looksLikeSmiles("1234"), false)
})

test("what RDKit writes but the editor cannot hold is reported, not dropped silently", () => {
  const dative = smilesToMolfile(rdkit, "N->[Pt](Cl)(Cl)<-N")
  assert.ok("molfile" in dative)
  const skipped = usableRecords([{ ...readMolfile(dative.molfile), properties: {} }])
  assert.equal(skipped.molecules.length, 0)
  assert.equal(skipped.problems[0]?.code, "bad-molfile")

  const radical = smilesToMolfile(rdkit, "[CH3]")
  assert.ok("molfile" in radical)
  const kept = usableRecords([{ ...readMolfile(radical.molfile), properties: {} }])
  assert.equal(kept.molecules.length, 1)
  assert.ok(kept.problems.some((problem) => problem.message.includes("radical")))
})

test("SMILES text becomes named records, and a bad line a record core leaves out", () => {
  const records = smilesRecords(rdkit, "CCO ethanol\nC(C\nc1ccccc1")
  assert.deepEqual(
    records.map((record) => [record.title, plainFormula(record.mol)]),
    [["ethanol", "C2H6O"], ["C(C", ""], ["c1ccccc1", "C6H6"]],
  )
  const usable = usableRecords(records)
  assert.equal(usable.molecules.length, 2)
  assert.equal(usable.skipped, 1)
})

test("[*:1] becomes the variable R1, as if typed on the atom, and a bare * becomes R", () => {
  const records = smilesRecords(rdkit, "c1ccccc1[*:1]\n[*:2]CC[*:1]\nc1ccccc1*")
  for (const record of records) assert.deepEqual(record.problems, [], record.title)
  const labels = records.map((record) => record.mol.atoms.flatMap((atom) => (atom.alias ? [atom.alias] : [])))
  assert.deepEqual(labels, [["R1"], ["R2", "R1"], ["R"]])
  assert.equal(plainFormula(records[0].mol), "C6H5", "the placeholder is not counted as carbon")

  const R = { alternatives: [{ kind: "label" as const, text: "Me" }] }
  const drawing = { molecule: records[1].mol, arrows: [], nextArrowId: 1, variables: { R1: R, R2: R } }
  assert.deepEqual(placeholders(drawing).map((item) => item.name).sort(), ["R1", "R2"])
})
