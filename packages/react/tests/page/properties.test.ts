import assert from "node:assert/strict"
import test from "node:test"
import initRDKitModule from "@rdkit/rdkit"
import { build } from "@structura/testkit"
import { inSlices } from "../../src/page/asyncSlices.ts"
import { computeProperties, parseDescriptors, peekProperties, propertyFields, propertyText, rdProperties, sdfProperties } from "../../src/page/properties.ts"
import { containsQuery, readQuery } from "../../src/page/structureMatch.ts"
import { exportNote } from "../../src/page/exportRows.ts"

const rdkit = await initRDKitModule()
const benzene = build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }]).molecule
const phenol = build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }, { op: "add_atom", el: "O", to: 1 }]).molecule

test("RDKit's descriptors are read by the names get_descriptors() gives them", () => {
  const found = rdProperties(rdkit, phenol)!
  // Phenol: cLogP 1.39 (Crippen), TPSA 20.23, one donor, one acceptor, no rotatable bond, 7 heavy atoms.
  assert.equal(found.logp.toFixed(2), "1.39")
  assert.equal(found.tpsa.toFixed(2), "20.23")
  assert.deepEqual([found.hbd, found.hba, found.rotb, found.heavy], [1, 1, 0, 7])
  assert.equal(peekProperties(phenol), found, "remembered per molecule")
  assert.equal(peekProperties(build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }]).molecule), undefined, "not computed yet is not unreadable")
})

test("descriptors that are missing make the whole read fail rather than give zeros", () => {
  assert.equal(parseDescriptors('{"tpsa":1}'), null)
  assert.equal(parseDescriptors("{}"), null)
})

test("properties go to CSV columns and SD items; weight and exact mass need no RDKit", () => {
  const fields = propertyFields(phenol, rdProperties(rdkit, phenol))
  assert.deepEqual(Object.keys(fields), ["ExactMass", "cLogP", "TPSA", "HBD", "HBA", "RotBonds", "HeavyAtoms"])
  assert.equal(fields.ExactMass, "94.0419")
  assert.equal(fields.HBD, "1")
  const without = propertyFields(phenol, undefined)
  assert.equal(without.ExactMass, "94.0419")
  assert.equal(without.cLogP, "", "what RDKit would say is left empty, not made up")
  const sdf = sdfProperties(phenol, rdProperties(rdkit, phenol))
  assert.equal(sdf.Formula, "C6H6O")
  assert.equal(sdf.MW, "94.11")
  assert.equal("cLogP" in sdfProperties(phenol, null), false, "an SD item with nothing to say is left out")
  assert.equal(propertyText("logp", 1.2345), "1.23")
})

test("a structure in SMILES or SMARTS is found in the compounds that contain it", () => {
  const phenyl = readQuery(rdkit, "c1ccccc1")!
  const hydroxyl = readQuery(rdkit, "[OX2H]c")!
  assert.equal(containsQuery(rdkit, phenyl, phenol), true)
  assert.equal(containsQuery(rdkit, hydroxyl, phenol), true)
  assert.equal(containsQuery(rdkit, hydroxyl, benzene), false)
  phenyl.delete()
  hydroxyl.delete()
  assert.equal(readQuery(rdkit, "c1ccc("), null, "text that is neither is refused, not thrown")
  assert.equal(readQuery(rdkit, "Xx"), null)
})

test("properties are computed for those not done, in slices that can be cancelled", async () => {
  const mols = Array.from({ length: 5 }, () => build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }]).molecule)
  assert.equal(await computeProperties(rdkit, mols), true)
  assert.ok(mols.every((mol) => peekProperties(mol) != null))
  const more = Array.from({ length: 5 }, () => build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }]).molecule)
  assert.equal(await computeProperties(rdkit, more, { cancelled: () => true }), false)
  assert.ok(more.every((mol) => peekProperties(mol) === undefined))
})

test("a slice of work gives the page its turn between slices", async () => {
  let ticks = 0
  const timer = setInterval(() => ticks++, 1)
  const done: number[] = []
  const finished = await inSlices(Array.from({ length: 40 }, (_, index) => index), (item) => {
    const end = performance.now() + 2
    while (performance.now() < end);
    done.push(item)
  })
  clearInterval(timer)
  assert.equal(finished, true)
  assert.equal(done.length, 40)
  assert.ok(ticks > 0, "timers ran during the work")
})

test("what a download could not do is told by number, and nothing is said when all went well", () => {
  assert.equal(exportNote("csv", { saved: true, unreadable: [], noRdkit: false }), null)
  assert.equal(exportNote("smi", { saved: true, unreadable: ["C-3", "C-7"], noRdkit: false }), "有 2 个化合物 RDKit 读不了（C-3、C-7），没有写进文件。")
  assert.match(exportNote("csv", { saved: true, unreadable: ["1"], noRdkit: false })!, /SMILES 和 cLogP/)
  assert.match(exportNote("sdf", { saved: true, unreadable: Array.from({ length: 9 }, (_, index) => `C-${index}`), noRdkit: false })!, /^有 9 个.*C-5 等/)
  assert.match(exportNote("smi", { saved: false, unreadable: [], noRdkit: true })!, /没有生成文件/)
  assert.match(exportNote("csv", { saved: true, unreadable: [], noRdkit: true })!, /RDKit 没有加载/)
})
