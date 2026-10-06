import assert from "node:assert/strict"
import test from "node:test"
import { BOND_LENGTH } from "@structura/core/constants"
import { readDocument, toDocument } from "@structura/core/document"
import { alternativesFromText, enumerate } from "@structura/markush"
import type { Molecule } from "@structura/core/types"
import { build, closestPair, label, run, tryRun } from "@structura/testkit"
import { chemistry } from "@structura/testkit/chem"

const { canonicalAll } = await chemistry()

/** Benzene with R1 and R2 on neighbouring atoms, each H or Me. */
const formula = () =>
  build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 1, as: "r1" },
    { op: "label", atom: "r1", text: "R1" },
    { op: "add_atom", el: "C", to: 2, as: "r2" },
    { op: "label", atom: "r2", text: "R2" },
    { op: "set_variable", name: "R1", alternatives: [label("H"), label("Me")] },
    { op: "set_variable", name: "R2", alternatives: [label("H"), label("Me")] },
  ])

test("R1 and R2 may also close a ring together: (CH2)3–4 on benzene adds indane and tetralin", () => {
  const drawing = run(formula(), [{ op: "set_ring_closure", closure: { a: "R1", b: "R2", ring: alternativesFromText("(CH2)3-4").add } }])
  const result = enumerate(drawing)
  assert.equal(result.failed, 0, JSON.stringify(result.failures))
  assert.deepEqual(
    canonicalAll(result.molecules),
    canonicalAll(["c1ccccc1", "Cc1ccccc1", "Cc1ccccc1", "Cc1ccccc1C", "c1ccc2c(c1)CCC2", "c1ccc2c(c1)CCCC2"]),
  )
  // The closed rings are drawn tidily: bonds near their length, no atoms on top of each other.
  for (const mol of result.molecules.slice(4)) assertTidy(mol)
  const closed = result.picks.filter((picks) => picks.some((pick) => pick.name === "R1+R2"))
  assert.equal(closed.length, 2)
})

function assertTidy(mol: Molecule) {
  const at = new Map(mol.atoms.map((atom) => [atom.id, atom]))
  for (const bond of mol.bonds) {
    const length = Math.hypot(at.get(bond.a)!.x - at.get(bond.b)!.x, at.get(bond.a)!.y - at.get(bond.b)!.y)
    assert.ok(length > BOND_LENGTH * 0.6 && length < BOND_LENGTH * 1.5, `bond ${bond.a}-${bond.b} is ${length.toFixed(1)} long`)
  }
  assert.ok(closestPair(mol) > BOND_LENGTH * 0.45, "no two atoms on top of each other")
}

test("ring closures are checked, saved, and keep their variables from being removed", () => {
  const drawing = formula()
  for (const [closure, message] of [
    [{ a: "R1", b: "R9", ring: alternativesFromText("(CH2)3").add }, /no variable R9/],
    [{ a: "R1", b: "R1", ring: alternativesFromText("(CH2)3").add }, /two different variables/],
    [{ a: "R1", b: "R2", ring: [] }, /what ring/],
    [{ a: "R1", b: "R2", ring: [label("O")] }, /drawn piece/],
  ] as const) {
    const result = tryRun(drawing, [{ op: "set_ring_closure", closure: closure as never }])
    assert.ok(!result.ok && message.test(result.error), result.ok ? "accepted" : result.error)
  }
  const kept = run(drawing, [{ op: "set_ring_closure", closure: { a: "R1", b: "R2", ring: alternativesFromText("(CH2)3").add } }])
  assert.ok(!tryRun(kept, [{ op: "remove_variable", name: "R2" }]).ok)
  const reread = readDocument(toDocument(kept))
  assert.ok("drawing" in reread)
  // Compared as saved: fields left undefined in memory are simply absent in the file.
  assert.equal(JSON.stringify(reread.drawing.ringClosures), JSON.stringify(kept.ringClosures))
  assert.equal(run(kept, [{ op: "remove_ring_closure", a: "R2", b: "R1" }]).ringClosures, undefined)
})

test("rings written out close too: OCH2O gives a benzodioxole, CH=CHCH=CH a naphthalene", () => {
  const typed = alternativesFromText("OCH2O, CH=CHCH=CH, C(=O)NH")
  assert.deepEqual(typed.rejected, [])
  assert.deepEqual(typed.add.map((item) => (item.kind === "fragment" ? item.name : item.kind)), ["OCH2O", "CH=CHCH=CH", "C(=O)NH"])
  // A known group stays a label: CH2CH3 is ethyl, not a two-ended chain.
  assert.deepEqual(alternativesFromText("CH2CH3").add.map((item) => item.kind), ["label"])
  const drawing = run(formula(), [
    { op: "set_variable", name: "R1", alternatives: [label("H")] },
    { op: "set_variable", name: "R2", alternatives: [label("H")] },
    { op: "set_ring_closure", closure: { a: "R1", b: "R2", ring: alternativesFromText("OCH2O, CH=CHCH=CH").add } },
  ])
  const result = enumerate(drawing)
  assert.equal(result.failed, 0, JSON.stringify(result.failures))
  assert.deepEqual(canonicalAll(result.molecules), canonicalAll(["c1ccccc1", "c1ccc2c(c1)OCO2", "c1ccc2ccccc2c1"]))
  for (const mol of result.molecules.slice(1)) assertTidy(mol)
})
