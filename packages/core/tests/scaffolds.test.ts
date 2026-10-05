import assert from "node:assert/strict"
import test from "node:test"
import { BOND_LENGTH } from "../src/constants.ts"
import { emptyDrawing } from "../src/drawing.ts"
import { plainFormula } from "../src/formula.ts"
import { applyOps, type Op } from "../src/ops.ts"
import { scaffoldCatalog, scaffoldNamed, scaffolds, siteAtom } from "../src/scaffolds.ts"
import type { Molecule } from "../src/types.ts"
import { validate } from "../src/validate.ts"

const FORMULAS: Record<string, string> = {
  benzene: "C6H6", pyridine: "C5H5N", pyrimidine: "C4H4N2", pyrazine: "C4H4N2", triazine: "C3H3N3",
  furan: "C4H4O", thiophene: "C4H4S", pyrrole: "C4H5N", naphthalene: "C10H8", quinoline: "C9H7N",
  isoquinoline: "C9H7N", indole: "C8H7N", benzofuran: "C8H6O", benzothiophene: "C8H6S", benzimidazole: "C7H6N2",
  benzoxazole: "C7H5NO", benzothiazole: "C7H5NS", anthracene: "C14H10", phenanthrene: "C14H10", fluorene: "C13H10",
  carbazole: "C12H9N", dibenzofuran: "C12H8O", dibenzothiophene: "C12H8S", phenoxazine: "C12H9NO", phenothiazine: "C12H9NS",
}

function run(ops: Op[]) {
  const result = applyOps(emptyDrawing(), ops)
  assert.ok(result.ok, result.ok ? "" : `op ${result.index}: ${result.error}`)
  return result.drawing.molecule
}

/** Bonds near their length, no atoms on top of each other, no valence broken. */
function assertTidy(mol: Molecule, what: string) {
  assert.deepEqual(validate(mol).filter((problem) => problem.code === "valence").map((problem) => problem.message), [], what)
  const at = new Map(mol.atoms.map((atom) => [atom.id, atom]))
  for (const bond of mol.bonds) {
    const length = Math.hypot(at.get(bond.a)!.x - at.get(bond.b)!.x, at.get(bond.a)!.y - at.get(bond.b)!.y)
    assert.ok(length > BOND_LENGTH * 0.8 && length < BOND_LENGTH * 1.25, `${what}: bond ${bond.a}-${bond.b} is ${length.toFixed(1)} long`)
  }
  for (const [i, a] of mol.atoms.entries()) for (const b of mol.atoms.slice(i + 1)) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > BOND_LENGTH * 0.5, `${what}: atoms ${a.id} and ${b.id} overlap`)
}

test("every scaffold is the ring system it says, drawn with even bonds", () => {
  assert.deepEqual(scaffolds().map((scaffold) => scaffold.name).sort(), Object.keys(FORMULAS).sort())
  for (const scaffold of scaffolds()) {
    assert.equal(plainFormula(scaffold.molecule), FORMULAS[scaffold.name], scaffold.name)
    assertTidy(scaffold.molecule, scaffold.name)
  }
})

test("sites are named the IUPAC way, and bonds lettered round the outside", () => {
  const carbazole = scaffoldNamed("carbazole")!
  const el = (locant: string) => carbazole.molecule.atoms.find((atom) => atom.id === carbazole.atoms[locant])!.el
  assert.equal(el("N9"), "N")
  assert.equal(siteAtom(carbazole, "9"), carbazole.atoms.N9)
  assert.equal(siteAtom(carbazole, "C3"), carbazole.atoms.C3)
  assert.deepEqual(carbazole.edges.a, [carbazole.atoms.C1, carbazole.atoms.C2])
  const naphthalene = scaffoldNamed("naphthalene")!
  assert.deepEqual(Object.keys(naphthalene.edges), ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"])
  assert.match(scaffoldCatalog(), /carbazole \(咔唑\): atoms C1 C2 C3 C4 C4a C4b C5 C6 C7 C8 C8a N9 C9a; bonds a=C1-C2/)
})

test("an agent builds N-phenylcarbazole and 3,6-diphenylcarbazole from a few ops", () => {
  const nPhenyl = run([
    { op: "add_scaffold", name: "carbazole", as: "cz" },
    { op: "add_scaffold", name: "benzene", site: "C1", to: "cz.N9" },
  ])
  assert.equal(plainFormula(nPhenyl), "C18H13N")
  assertTidy(nPhenyl, "N-phenylcarbazole")
  const diphenyl = run([
    { op: "add_scaffold", name: "carbazole", as: "cz" },
    { op: "add_scaffold", name: "benzene", site: "C1", to: "cz.C3" },
    { op: "add_scaffold", name: "benzene", site: "C1", to: "cz.C6" },
  ])
  assert.equal(plainFormula(diphenyl), "C24H17N")
  assertTidy(diphenyl, "3,6-diphenylcarbazole")
})

test("a scaffold fuses onto a bond at a lettered edge: benzene + furan's b edge is benzofuran", () => {
  const benzofuran = run([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_scaffold", name: "furan", edge: "b", onto: { between: [1, 2] } },
  ])
  assert.equal(plainFormula(benzofuran), "C8H6O")
  assertTidy(benzofuran, "benzofuran")
  const naphthalene = run([
    { op: "add_scaffold", name: "benzene", as: "ring" },
    { op: "add_scaffold", name: "benzene", edge: "a", onto: { between: ["ring.C3", "ring.C4"] } },
  ])
  assert.equal(plainFormula(naphthalene), "C10H8")
  assertTidy(naphthalene, "naphthalene")
})

test("a scaffold that cannot go there says why", () => {
  const full = applyOps(emptyDrawing(), [
    { op: "add_scaffold", name: "carbazole", as: "cz" },
    { op: "add_scaffold", name: "benzene", site: "C1", to: "cz.C4a" },
  ])
  assert.equal(full.ok, false)
  assert.equal(applyOps(emptyDrawing(), [{ op: "add_scaffold", name: "unobtainium" }]).ok, false)
  assert.equal(applyOps(emptyDrawing(), [{ op: "add_scaffold", name: "benzene", as: "a" }, { op: "add_scaffold", name: "benzene", site: "C9", to: "a.C1" }]).ok, false)
})

test("free sites are the atoms with a hydrogen; the default is the N–H, else the first", async () => {
  const { defaultSite, freeSites } = await import("../src/scaffolds.ts")
  assert.equal(defaultSite(scaffoldNamed("carbazole")!), "N9")
  assert.equal(defaultSite(scaffoldNamed("phenothiazine")!), "N10")
  assert.equal(defaultSite(scaffoldNamed("dibenzofuran")!), "C1")
  assert.equal(defaultSite(scaffoldNamed("pyridine")!), "C2")
  assert.ok(!freeSites(scaffoldNamed("carbazole")!).includes("C4a"))
})

test("the names as.C3, as.N9… point at those very atoms, and a joined template keeps its regular rings", () => {
  const result = applyOps(emptyDrawing(), [
    { op: "add_scaffold", name: "carbazole", as: "cz" },
    { op: "add_scaffold", name: "benzene", site: "C1", to: "cz.C3", as: "ph" },
  ])
  assert.ok(result.ok, result.ok ? "" : result.error)
  const mol = result.drawing.molecule
  const { names } = result
  const neighbours = (id: number) => mol.bonds.flatMap((bond) => (bond.a === id ? [bond.b] : bond.b === id ? [bond.a] : []))
  assert.equal(mol.atoms.find((atom) => atom.id === names["cz.N9"])!.el, "N")
  assert.equal(neighbours(names["cz.C4a"]).length, 3, "C4a is a fusion atom")
  assert.ok(neighbours(names["cz.C3"]).includes(names["cz.C4"]) && neighbours(names["cz.C4"]).includes(names["cz.C4a"]), "C3–C4–C4a in a row")
  assert.ok(neighbours(names["cz.C3"]).includes(names["ph.C1"]), "the phenyl's C1 is on C3")
  // The phenyl ring is still a regular hexagon: all six bonds the same length.
  const ring = ["C1", "C2", "C3", "C4", "C5", "C6"].map((locant) => mol.atoms.find((atom) => atom.id === names[`ph.${locant}`])!)
  const lengths = ring.map((atom, index) => Math.hypot(atom.x - ring[(index + 1) % 6].x, atom.y - ring[(index + 1) % 6].y))
  assert.ok(Math.max(...lengths) - Math.min(...lengths) < 0.01, lengths.join(", "))
})

test("fusing goes by carbon–carbon outer bonds only; the default is the first such bond", async () => {
  const { defaultEdge, fusableEdges, matchScaffolds } = await import("../src/scaffolds.ts")
  assert.equal(defaultEdge(scaffoldNamed("benzene")!), "a")
  assert.equal(defaultEdge(scaffoldNamed("furan")!), "b")
  assert.equal(defaultEdge(scaffoldNamed("pyridine")!), "b")
  assert.ok(!fusableEdges(scaffoldNamed("naphthalene")!).includes("d"), "C4–C4a holds a fusion atom")
  const onHetero = applyOps(emptyDrawing(), [
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_scaffold", name: "furan", edge: "a", onto: { between: [1, 2] } },
  ])
  assert.equal(onHetero.ok, false)
  assert.match(onHetero.ok ? "" : onHetero.error, /heteroatom/)
  assert.equal(matchScaffolds("咔唑")[0].name, "carbazole")
  assert.deepEqual(matchScaffolds("thio").map((item) => item.name), ["thiophene", "benzothiophene", "dibenzothiophene"])
  assert.equal(matchScaffolds("").length, scaffolds().length)
  assert.deepEqual(matchScaffolds("xyz"), [])
})
