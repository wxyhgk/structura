import assert from "node:assert/strict"
import test from "node:test"
import { usableRecords } from "../../src/chem/import.ts"
import { createBondAt, emptyMolecule } from "../../src/chem/molecule.ts"
import { toMolfile } from "../../src/chem/molfile.ts"
import { readMolfile, readSdf } from "../../src/chem/sdf.ts"
import { validate } from "../../src/chem/validate.ts"

const SINGLE = { order: 1 as const, stereo: "none" as const }
const ethane = () => toMolfile(createBondAt(emptyMolecule(), { x: 0, y: 0 }, SINGLE), "ethane")

test("a counts line with negative numbers is an error, not a crash", () => {
  const broken = ethane().replace("  2  1  0", "  2 -1  0")
  const read = readMolfile(broken)
  assert.equal(read.problems[0]?.code, "bad-molfile")
  assert.equal(read.problems[0]?.severity, "error")
})

test("one unreadable record does not stop the rest of an SDF", () => {
  const text = [ethane(), ethane().replace("  2  1  0", "  2 -1  0"), ethane()].map((block) => `${block}$$$$\n`).join("")
  const records = readSdf(text)
  assert.equal(records.length, 3)
  const imported = usableRecords(records)
  assert.equal(imported.molecules.length, 2)
  assert.equal(imported.skipped, 1)
  assert.ok(imported.problems.every((problem) => problem.record === 2))
})

test("broken pieces of a file are dropped so the drawing stays editable", () => {
  const lines = ethane().split("\n")
  const bondLine = lines[6]
  lines.splice(7, 0, bondLine.replace(/^( +1)( +2)/, "  2  1"))
  lines[3] = lines[3].replace("  2  1  0", "  2  2  0")
  lines[4] = lines[4].replace(/^ +\S+/, "  Infinity")
  const withIsotope = lines.join("\n").replace("M  END", "M  ISO  1   1   0\nM  END")
  const read = readMolfile(withIsotope)
  assert.equal(read.mol.bonds.length, 1)
  assert.ok(read.mol.atoms.every((atom) => Number.isFinite(atom.x) && Number.isFinite(atom.y)))
  assert.equal(read.mol.atoms[0].isotope, undefined)
  assert.deepEqual(validate(read.mol).filter((problem) => problem.severity === "error"), [])
  assert.ok(read.problems.some((problem) => problem.message.includes("repeats")))
  assert.ok(read.problems.some((problem) => problem.message.includes("mass number 0")))
})

test("empty records are left out and explained", () => {
  const imported = usableRecords([{ mol: emptyMolecule(), title: "nothing", properties: {}, problems: [] }])
  assert.equal(imported.molecules.length, 0)
  assert.equal(imported.skipped, 1)
  assert.match(imported.problems[0]?.message ?? "", /no atoms/)
})
