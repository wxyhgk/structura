import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { BOND_LENGTH } from "../src/constants.ts"
import { emptyMolecule } from "../src/molecule.ts"
import { createBondAt } from "../src/layout.ts"
import { toMolfile, toSdf } from "../src/molfile.ts"
import { readMolfile, readSdf, type MolRecord } from "../src/sdf.ts"
import type { Atom, Bond, Bracket, Molecule } from "../src/types.ts"

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

/** A zigzag chain of `count` carbons, with one of everything the writers carry spread along it. */
function chain(count: number): { mol: Molecule; brackets: Bracket[] } {
  const atoms: Atom[] = Array.from({ length: count }, (_, at) => ({ id: at + 1, el: "C", x: at * BOND_LENGTH * 0.8, y: (at % 2) * BOND_LENGTH * 0.6, charge: 0 }))
  atoms[1].charge = -1
  atoms[2].isotope = 13
  atoms[3].el = "Sn"
  atoms[4].alias = "R2"
  atoms[5].alias = "NH 2"
  atoms[6].el = "O"
  // Last on its line, the dash must not read as "goes on in the next line".
  atoms[7].alias = "CO2-"
  atoms[count - 1].charge = 2
  const bonds: Bond[] = atoms.slice(1).map((_, at) => ({ id: at + 1, a: at + 1, b: at + 2, order: 1, stereo: "none" }))
  bonds[0].stereo = "up"
  bonds[1].stereo = "down"
  bonds[2].stereo = "either"
  bonds[3].order = 2
  bonds[4].order = 3
  const mol: Molecule = { ...emptyMolecule(), atoms, bonds, nextAtomId: count + 1, nextBondId: count }
  // A repeat unit and a group, the second long enough that its atom list goes on over lines.
  const brackets: Bracket[] = [
    { id: 1, atoms: [8, 9, 10], kind: "repeat", repeat: { min: 2, max: 7, name: "m" } },
    { id: 2, atoms: atoms.slice(20, 220).map((atom) => atom.id), kind: "group" },
  ]
  return { mol, brackets }
}

test("more than 999 atoms or bonds is written as V3000, and reads back whole", () => {
  const { mol, brackets } = chain(1200)
  const text = toMolfile(mol, "big", brackets)
  const lines = text.split("\n")
  assert.ok(lines[3].endsWith("V3000"))
  assert.deepEqual(lines.filter((line) => line.length > 80), [], "no line is longer than V3000 allows")
  assert.ok(lines.some((line) => line.endsWith(" -")), "the long atom list is continued")
  const read = readMolfile(text)
  assert.deepEqual(read.problems, [])
  assert.equal(read.title, "big")
  assert.equal(read.mol.atoms.length, 1200)
  assert.equal(read.mol.bonds.length, 1199)
  assert.deepEqual(
    read.mol.atoms.map(({ x: _x, y: _y, ...atom }) => atom),
    mol.atoms.map(({ x: _x, y: _y, ...atom }) => (atom.alias != null || atom.el === "Sn" ? { ...atom, ...(atom.alias == null ? {} : { el: "C" }) } : atom)),
  )
  assert.deepEqual(read.mol.bonds, mol.bonds)
  assert.deepEqual(read.brackets, brackets)
  for (const [at, atom] of mol.atoms.entries()) assert.ok(Math.hypot(atom.x - read.mol.atoms[at].x, atom.y - read.mol.atoms[at].y) < 0.01)
})

/** `bonds` bonds among 60 atoms, every pair joined until they run out. */
function dense(bonds: number): Molecule {
  const atoms: Atom[] = Array.from({ length: 60 }, (_, at) => ({ id: at + 1, el: "C", x: at * 10, y: 0, charge: 0 }))
  const all = atoms.flatMap((a, at) => atoms.slice(at + 1).map((b) => ({ a: a.id, b: b.id, order: 1 as const, stereo: "none" as const })))
  return { ...emptyMolecule(), atoms, bonds: all.slice(0, bonds).map((bond, at) => ({ ...bond, id: at + 1 })), nextAtomId: 61, nextBondId: bonds + 1 }
}

test("a repeat count the editor cannot hold falls back to 1-4 and says so", () => {
  const { mol, brackets } = chain(30)
  const text = toMolfile(mol, "t", brackets)
  assert.ok(text.includes("2-7"))
  const read = readMolfile(text.replace("2-7", "1-500"))
  assert.deepEqual(read.brackets?.[0].repeat, { min: 1, max: 4, name: "m" })
  assert.ok(read.problems.some((problem) => /counted 1-500/.test(problem.message)))
})

test("999 atoms and 999 bonds are still V2000; one more of either is V3000", () => {
  const edge = toMolfile(dense(999))
  assert.ok(edge.split("\n")[3].startsWith(" 60999"))
  assert.ok(edge.split("\n")[3].endsWith("V2000"))
  assert.equal(readMolfile(edge).mol.bonds.length, 999)
  const over = toMolfile(dense(1000))
  assert.ok(over.split("\n")[3].endsWith("V3000"))
  assert.equal(readMolfile(over).mol.bonds.length, 1000)
  assert.ok(toMolfile(chain(999).mol).split("\n")[3].startsWith("999998"))
  assert.ok(toMolfile(chain(999).mol).split("\n")[3].endsWith("V2000"))
  assert.ok(toMolfile(chain(1000).mol).split("\n")[3].endsWith("V3000"))
})

test("a V3000 molfile reads back to what a V2000 one of the same molecule does", () => {
  const { mol, brackets } = chain(30)
  const small = readMolfile(toMolfile(mol, "t", brackets))
  const forced = readMolfile(toMolfile({ ...mol, atoms: [...mol.atoms, ...Array.from({ length: 1000 }, (_, at) => ({ id: 100 + at, el: "He", x: 0, y: 0, charge: 0 }))] }, "t", brackets))
  assert.deepEqual(forced.mol.atoms.slice(0, 30).map(({ x: _x, y: _y, ...atom }) => atom), small.mol.atoms.map(({ x: _x, y: _y, ...atom }) => atom))
  assert.deepEqual(forced.mol.bonds, small.mol.bonds)
  assert.deepEqual(forced.brackets, small.brackets)
})

test("an SD file carries a big molecule as V3000 beside a small one as V2000", () => {
  const { mol } = chain(1100)
  const records = readSdf(toSdf([chain(10).mol, mol]))
  assert.deepEqual(records.map((record) => record.mol.atoms.length), [10, 1100])
})
