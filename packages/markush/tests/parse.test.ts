import assert from "node:assert/strict"
import test from "node:test"
import { label } from "@structura/testkit"
import { alternativesFromText } from "@structura/markush"

test("typed alternatives: labels, shorthands, a bond and divalent rings, without repeats", () => {
  assert.deepEqual(alternativesFromText("H, D，卤素、CN  Me"), {
    add: [label("H"), label("D"), label("F"), label("Cl"), label("Br"), label("I"), label("CN"), label("Me")],
    rejected: [],
  })
  assert.deepEqual(alternativesFromText("单键, 对亚苯基, 2,5-亚吡啶基, 4,4′-联亚苯基, O"), {
    add: [
      { kind: "bond" },
      { kind: "bridge", name: "p-phenylene" },
      { kind: "bridge", name: "2,5-pyridinediyl" },
      { kind: "bridge", name: "4,4'-biphenylene" },
      label("O"),
    ],
    rejected: [],
  })
})

test("what is already there is not added twice, and what is not a structure comes back", () => {
  assert.deepEqual(alternativesFromText("F, Cl, F", [label("F")]), { add: [label("Cl")], rejected: [] })
  assert.deepEqual(alternativesFromText("H, C1-C30, alkyl, C1-C30"), { add: [label("H")], rejected: ["C1-C30", "alkyl"] })
  assert.deepEqual(alternativesFromText("bond BOND", [{ kind: "bond" }]), { add: [], rejected: [] })
  assert.deepEqual(alternativesFromText(""), { add: [], rejected: [] })
})

test("ring members with variables: 'X is N or CR3' gives pyridine, or the ring carbon carrying R3", async () => {
  const { chemistry } = await import("@structura/testkit/chem")
  const { canonicalAll } = await chemistry()
  const { build, run } = await import("@structura/testkit")
  const { enumerate } = await import("@structura/markush")
  const typed = alternativesFromText("N, CR3, CH")
  assert.deepEqual(typed.rejected, [])
  assert.deepEqual(
    typed.add.map((item) => (item.kind === "fragment" ? item.name : item.kind === "label" ? item.text : item.kind)),
    ["N", "CR3", "C"],
  )
  const formula = run(build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }, { op: "label", atom: 1, text: "X" }]), [
    { op: "set_variable", name: "X", alternatives: alternativesFromText("N, CR3").add },
    { op: "set_variable", name: "R3", alternatives: [label("H"), label("Cl")] },
  ])
  const result = enumerate(formula)
  assert.equal(result.failed, 0, JSON.stringify(result.failures))
  assert.deepEqual(canonicalAll(result.molecules), canonicalAll(["c1ccncc1", "c1ccccc1", "Clc1ccccc1"]))
})

test("a chain length range: (CH2)0-2 between two phenyls gives biphenyl, diphenylmethane and bibenzyl", async () => {
  const { chemistry } = await import("@structura/testkit/chem")
  const { canonicalAll } = await chemistry()
  const { build, run } = await import("@structura/testkit")
  const { enumerate } = await import("@structura/markush")
  const typed = alternativesFromText("(CH2)0-2")
  assert.deepEqual(typed.add.map((item) => (item.kind === "fragment" ? item.name : item.kind)), ["bond", "CH2", "(CH2)2"])
  assert.deepEqual(alternativesFromText("(CH2)3-1").rejected, ["(CH2)3-1"])
  const formula = run(
    build([
      { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
      { op: "add_atom", el: "C", to: 1, as: "l" },
      { op: "label", atom: "l", text: "L" },
      { op: "add_atom", el: "C", to: "l", as: "p" },
      { op: "label", atom: "p", text: "Ph" },
    ]),
    [{ op: "set_variable", name: "L", alternatives: typed.add }],
  )
  const result = enumerate(formula)
  assert.equal(result.failed, 0, JSON.stringify(result.failures))
  assert.deepEqual(canonicalAll(result.molecules), canonicalAll(["c1ccc(-c2ccccc2)cc1", "c1ccc(Cc2ccccc2)cc1", "c1ccc(CCc2ccccc2)cc1"]))
})
