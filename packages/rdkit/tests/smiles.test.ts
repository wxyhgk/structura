import assert from "node:assert/strict"
import test from "node:test"
import initRDKitModule from "@rdkit/rdkit"
import { plainFormula } from "@structura/core/formula"
import { usableRecords } from "@structura/core/import"
import { placeholders } from "@structura/markush"
import { toMolfile } from "@structura/core/molfile"
import { readMolfile } from "@structura/core/sdf"
import { looksLikeSmiles, smilesFault, smilesLines, smilesRecords, smilesToMolfile, type SmilesFault } from "../src/index.ts"

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

test("bad SMILES are reported with RDKit's reason, sorted by kind", () => {
  const cases: Array<[string, SmilesFault, string]> = [
    ["CC(=O", { kind: "open-parenthesis" }, "extra open parentheses while parsing: CC(=O; check for mistakes around position 3"],
    ["C1CC1)C", { kind: "close-parenthesis" }, "extra close parentheses"],
    ["C1CC", { kind: "unclosed-ring" }, "unclosed ring for input: 'C1CC'"],
    ["C[Xx]", { kind: "syntax", position: 3 }, "syntax error while parsing: C[Xx]"],
    ["FC(F)(F)(F)(F)F", { kind: "valence", atom: 2, element: "C", valence: 6 }, "Explicit valence for atom # 1 C, 6, is greater than permitted"],
    ["Cc1ccnc1", { kind: "kekulize", atoms: [2, 3, 4, 5, 6] }, "Can't kekulize mol. Unkekulized atoms: 1 2 3 4 5"],
  ]
  for (const [bad, fault, words] of cases) {
    const result = smilesToMolfile(rdkit, bad)
    assert.ok("error" in result, bad)
    assert.deepEqual(result.fault, fault, bad)
    assert.ok(result.error.startsWith(`RDKit could not read "${bad}": `), result.error)
    assert.ok(result.error.includes(words), result.error)
    assert.ok(!/\[\d\d:\d\d:\d\d\]|~\^/.test(result.error), `no timestamps or marker: ${result.error}`)
    assert.deepEqual(smilesFault(result.error), fault, "the fault reads back from the error")
  }
  assert.equal(smilesFault("RDKit could not read \"?\""), null)
  // The capture ends with the call: a good SMILES after a bad one reads as before.
  assert.ok("molfile" in smilesToMolfile(rdkit, "CCO"))
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

/** The angle, in degrees from level (0–90), of the line through the two atoms furthest apart. */
function axisTilt(mol: { atoms: Array<{ x: number; y: number }> }): number {
  let far = { length: 0, angle: 0 }
  for (const [index, a] of mol.atoms.entries())
    for (const b of mol.atoms.slice(index + 1)) {
      const length = Math.hypot(b.x - a.x, b.y - a.y)
      if (length > far.length) far = { length, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI }
    }
  const folded = ((far.angle % 180) + 180) % 180
  return Math.min(folded, 180 - folded)
}

test("SMILES come in lying level: the longest axis turned across, by a multiple of 30°, nothing else changed", () => {
  const LEVEL = ["CCCCCCCCCCCC", "CC(C)Cc1ccc(cc1)[C@H](C)C(=O)O", "c1ccc2cc3ccccc3cc2c1", "CC(=O)Oc1ccccc1C(=O)O", "O=C(O)c1ccc(cc1)-c1ccc(cc1)-c1ccccc1", "C[C@@H](N)Cc1ccc(O)cc1"]
  let turned = 0
  for (const smiles of LEVEL) {
    const result = smilesToMolfile(rdkit, smiles)
    assert.ok("molfile" in result)
    const asLaidOut = readMolfile(result.molfile).mol
    const [record] = smilesRecords(rdkit, smiles)
    assert.ok(axisTilt(record.mol) <= 15 + 1e-9, `${smiles} tilts ${axisTilt(record.mol).toFixed(1)}°`)
    if (axisTilt(asLaidOut) > 15) turned++
    // A rigid turn by k·30°: every bond keeps its length, and its direction moves by the same multiple of 30°.
    const at = (mol: typeof asLaidOut, id: number) => mol.atoms.find((atom) => atom.id === id)!
    const steps = asLaidOut.bonds.map((bond) => {
      const [a0, b0, a1, b1] = [at(asLaidOut, bond.a), at(asLaidOut, bond.b), at(record.mol, bond.a), at(record.mol, bond.b)]
      assert.ok(Math.abs(Math.hypot(b1.x - a1.x, b1.y - a1.y) - Math.hypot(b0.x - a0.x, b0.y - a0.y)) < 1e-6)
      const turn = (Math.atan2(b1.y - a1.y, b1.x - a1.x) - Math.atan2(b0.y - a0.y, b0.x - a0.x)) / (Math.PI / 6)
      assert.ok(Math.abs(turn - Math.round(turn)) < 1e-6, `${smiles} turned by ${turn * 30}°`)
      return ((Math.round(turn) % 12) + 12) % 12
    })
    assert.equal(new Set(steps).size, 1, `${smiles}: every bond turned alike`)
    assert.equal(canonical(toMolfile(record.mol)), canonical(smiles), `${smiles} keeps its structure and stereo`)
  }
  assert.ok(turned >= 2, `only ${turned} needed turning`)
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
