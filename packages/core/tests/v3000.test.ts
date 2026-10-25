import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { createBondAt, emptyMolecule } from "../src/molecule.ts"
import { toMolfile } from "../src/molfile.ts"
import { readMolfile, readSdf, type MolRecord } from "../src/sdf.ts"

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")
const SINGLE = { order: 1 as const, stereo: "none" as const }

/** A record without its coordinates or record number, for comparing. */
function apart(record: MolRecord) {
  const atoms = record.mol.atoms.map(({ x: _x, y: _y, ...atom }) => atom)
  return { ...record, mol: { ...record.mol, atoms }, problems: record.problems.map(({ record: _record, ...problem }) => problem) }
}

test("an SD file mixing V2000 and V3000 reads each V3000 record as its V2000 twin", () => {
  const records = readSdf(fixture("v2000-v3000.sdf"))
  assert.equal(records.length, 6)
  for (let index = 0; index < records.length; index += 2) {
    const [v2000, v3000] = [records[index], records[index + 1]]
    assert.deepEqual(apart(v3000), apart(v2000), v2000.title)
    // V3000 carries more digits than V2000: the same place to a few hundredths of a pixel.
    v3000.mol.atoms.forEach((atom, at) => assert.ok(Math.hypot(atom.x - v2000.mol.atoms[at].x, atom.y - v2000.mol.atoms[at].y) < 0.05, v2000.title))
  }
})

test("V3000 atoms and bonds: charges, isotopes, wedges and hashes", () => {
  const [, alanine] = readSdf(fixture("v2000-v3000.sdf"))
  assert.deepEqual(alanine.problems, [])
  assert.equal(alanine.properties.smiles, "[2H][C@]([13CH3])(C(=O)[O-])[NH3+]")
  const atoms = alanine.mol.atoms.map((atom) => [atom.el, atom.charge, atom.isotope ?? null])
  assert.deepEqual(atoms, [["C", 0, 13], ["C", 0, null], ["N", 1, null], ["C", 0, null], ["O", 0, null], ["O", -1, null], ["H", 0, 2]])
  assert.deepEqual(alanine.mol.bonds.map((bond) => bond.stereo), ["up", "none", "none", "none", "none", "down"])
  assert.equal(alanine.mol.bonds[3].order, 2)
})

test("V3000 R-groups, repeat units and what the editor cannot hold", () => {
  const [, , , generic] = readSdf(fixture("v2000-v3000.sdf"))
  assert.deepEqual(generic.mol.atoms.map((atom) => atom.alias ?? null), ["R1", null, null, null, null, null, "R2", null])
  assert.deepEqual(generic.brackets, [{ id: 1, atoms: [2, 3], kind: "repeat", repeat: { min: 2, max: 5, name: "n" } }])
  const notes = generic.problems.map((problem) => problem.message)
  assert.ok(notes.some((message) => message.includes("radical")), "the radical is noted")
  assert.ok(notes.some((message) => message.includes("SUP")), "the abbreviation is noted")
  assert.ok(generic.problems.every((problem) => problem.severity === "warning"))

  const [, , , , , pyridinium] = readSdf(fixture("v2000-v3000.sdf"))
  assert.deepEqual(pyridinium.problems, [])
  assert.equal(pyridinium.mol.bonds.filter((bond) => bond.order === 2).length, 3, "aromatic bonds kekulized")
})

/** Ethane as V3000, with `atoms`, `bonds` and `extra` lines (each without its M  V30 prefix). */
function v3000(atoms: string[], bonds: string[], extra: string[] = []): string {
  const body = ["BEGIN CTAB", `COUNTS ${atoms.length} ${bonds.length} 0 0 0`, "BEGIN ATOM", ...atoms, "END ATOM", "BEGIN BOND", ...bonds, "END BOND", ...extra, "END CTAB"]
  return ["ethane", "  test", "", "  0  0  0     0  0            999 V3000", ...body.map((line) => `M  V30 ${line}`), "M  END", ""].join("\n")
}

test("V3000 atom indices need not run 1…n, and long lines go on after a dash", () => {
  const text = v3000(["10 C 0 0 0 0", "20 O 1.5 0 0 0 -\nM  V30 CHG=-1"], ["1 1 20 10"])
  const read = readMolfile(text)
  assert.deepEqual(read.problems, [])
  assert.deepEqual(read.mol.atoms.map((atom) => [atom.id, atom.el, atom.charge]), [[1, "C", 0], [2, "O", -1]])
  assert.deepEqual(read.mol.bonds.map((bond) => [bond.a, bond.b]), [[2, 1]])
})

test("V3000 the editor cannot hold is noted, never dropped silently; a broken table is an error", () => {
  const atoms = ["1 C 0 0 0 0", "2 C 1.5 0 0 0 ATTCHPT=1"]
  const noted = (extra: string[], bonds = ["1 1 1 2"]) => readMolfile(v3000(atoms, bonds, extra)).problems.map((problem) => problem.message)
  assert.ok(noted([]).some((message) => message.includes("ATTCHPT") && message.includes("atom 2")))
  assert.ok(noted(["BEGIN COLLECTION", "MDLV30/STEREL1 ATOMS=(1 1)", "END COLLECTION"]).some((message) => message.includes("COLLECTION")))
  assert.ok(noted([], ["1 9 1 2"]).some((message) => message.includes("coordination")))
  assert.ok(noted([], ["1 2 1 2 CFG=2"]).some((message) => message.includes("crossed double bond")))

  const unended = v3000(atoms, ["1 1 1 2"]).replace("M  V30 END CTAB\n", "")
  assert.equal(readMolfile(unended).problems[0]?.severity, "error")
  const dangling = readMolfile(v3000(atoms, ["1 1 1 3"]))
  assert.ok(dangling.problems.some((problem) => problem.severity === "error" && problem.message.includes("do not exist")))
})

test("a V3000 3D file is flattened and says so, as a V2000 one is", () => {
  const read = readMolfile(v3000(["1 C 0 0 0 0", "2 O 1.2 0 0.9 0"], ["1 1 1 2"]))
  assert.deepEqual(read.problems.map((problem) => problem.code), ["flattened-3d"])
})

test("V2000 still reads what it read before", () => {
  const text = toMolfile(createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE))
  assert.deepEqual(readMolfile(text).problems, [])
  assert.equal(toMolfile(readMolfile(text).mol), text)
})
