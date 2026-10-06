import assert from "node:assert/strict"
import test from "node:test"
import { readDocument, toDocument } from "@structura/core/document"
import { enumerate } from "@structura/markush"
import { build, label, run, tryRun } from "@structura/testkit"
import { chemistry } from "@structura/testkit/chem"

const { canonical, canonicalAll } = await chemistry()

/** Benzene with R1 and R2 next to each other, each H or Cl: four combinations. */
const formula = () =>
  build([
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 1, as: "r1" },
    { op: "label", atom: "r1", text: "R1" },
    { op: "add_atom", el: "C", to: 2, as: "r2" },
    { op: "label", atom: "r2", text: "R2" },
    { op: "set_variable", name: "R1", alternatives: [label("H"), label("Cl")] },
    { op: "set_variable", name: "R2", alternatives: [label("H"), label("Cl")] },
  ])

test("'R1 and R2 are not both H' and 'when R1 is Cl, R2 is not Cl' each take out their combination", () => {
  const notBothH = run(formula(), [{ op: "add_proviso", proviso: { kind: "combination", when: [{ name: "R1", is: [label("H")] }, { name: "R2", is: [label("H")] }] } }])
  const first = enumerate(notBothH)
  assert.equal(first.excluded, 1)
  assert.deepEqual(canonicalAll(first.molecules), canonicalAll(["Clc1ccccc1", "Clc1ccccc1", "Clc1ccccc1Cl"]))
  const both = run(notBothH, [{ op: "add_proviso", proviso: { kind: "combination", when: [{ name: "R1", is: [label("Cl")] }, { name: "R2", is: [label("Cl")] }] } }])
  const second = enumerate(both)
  assert.equal(second.excluded, 2)
  assert.deepEqual(canonicalAll(second.molecules), canonicalAll(["Clc1ccccc1", "Clc1ccccc1"]))
})

test("an excluded compound is matched by identity; without a way to read its SMILES it is reported unchecked", () => {
  const drawing = run(formula(), [{ op: "add_proviso", proviso: { kind: "compound", smiles: "Clc1ccccc1" } }])
  const checked = enumerate(drawing, { identity: (mol) => canonical(mol), identifySmiles: (smiles) => canonical(smiles) })
  // Chlorobenzene (two ways) is gone; benzene and o-dichlorobenzene remain.
  assert.deepEqual(canonicalAll(checked.molecules), canonicalAll(["c1ccccc1", "Clc1ccccc1Cl"]))
  assert.equal(checked.excluded, 2)
  const unchecked = enumerate(drawing)
  assert.equal(unchecked.uncheckedCompounds, 1)
  assert.equal(unchecked.molecules.length, 4)
})

test("a condition naming a class is met by the members standing in for it", () => {
  const drawing = run(formula(), [
    { op: "set_variable", name: "R1", alternatives: [label("H"), { kind: "class", class: "alkyl", min: 1, max: 2 }] },
    { op: "set_variable", name: "R2", alternatives: [label("H")] },
    { op: "add_proviso", proviso: { kind: "combination", when: [{ name: "R1", is: [{ kind: "class", class: "alkyl", min: 1, max: 2 }] }] } },
  ])
  const result = enumerate(drawing, { representatives: true })
  // Me, Et and CF3 stand in for C1–C2 alkyl, and all three are excluded: only R1 = H is left.
  assert.equal(result.excluded, 3)
  assert.deepEqual(canonicalAll(result.molecules), canonicalAll(["c1ccccc1"]))
})

test("provisos are checked, kept with the file, and keep their variables from being removed", () => {
  const drawing = formula()
  for (const [proviso, message] of [
    [{ kind: "combination", when: [{ name: "R9", is: [label("H")] }] }, /no variable R9/],
    [{ kind: "combination", when: [] }, /at least one condition/],
    [{ kind: "combination", when: [{ name: "R1", is: [] }] }, /lists no values/],
    [{ kind: "compound", smiles: " " }, /needs its SMILES/],
  ] as const) {
    const result = tryRun(drawing, [{ op: "add_proviso", proviso: proviso as never }])
    assert.ok(!result.ok && message.test(result.error), result.ok ? "accepted" : result.error)
  }
  const kept = run(drawing, [{ op: "add_proviso", proviso: { kind: "combination", when: [{ name: "R1", is: [label("H")] }] } }])
  const blocked = tryRun(kept, [{ op: "remove_variable", name: "R1" }])
  assert.ok(!blocked.ok && /proviso/.test(blocked.error))
  const reread = readDocument(toDocument(kept))
  assert.ok("drawing" in reread)
  assert.deepEqual(reread.drawing.provisos, kept.provisos)
  assert.equal(run(kept, [{ op: "remove_proviso", index: 0 }]).provisos, undefined)
})
