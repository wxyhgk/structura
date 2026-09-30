import assert from "node:assert/strict"
import test from "node:test"
import { alternativesFromText } from "../../src/chem/markush/parse.ts"

const label = (text: string) => ({ kind: "label" as const, text })

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
