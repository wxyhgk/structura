import assert from "node:assert/strict"
import test from "node:test"
import { alternativeProblem, enumerate, representativesOf } from "@structura/markush"
import type { Alternative } from "@structura/core/types"
import { build, run } from "@structura/testkit"
import { chemistry } from "@structura/testkit/chem"

const { canonicalAll } = await chemistry()

/** Phenyl as the one C6 aryl, optionally carrying 1–2 of F and Cl. */
const aryl = (extra: Partial<Extract<Alternative, { kind: "class" }>> = {}): Extract<Alternative, { kind: "class" }> => ({
  kind: "class",
  class: "aryl",
  min: 6,
  max: 6,
  substituents: { from: ["F", "Cl"], min: 0, max: 2 },
  ...extra,
})

test("'aryl optionally substituted with 1–2 of F, Cl' shows phenyl bare and carrying them, para first", () => {
  const formula = run(build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }, { op: "add_atom", el: "C", to: 1, as: "r" }, { op: "label", atom: "r", text: "R1" }]), [
    { op: "set_variable", name: "R1", alternatives: [aryl()] },
  ])
  const result = enumerate(formula, { representatives: true })
  assert.equal(result.failed, 0, JSON.stringify(result.failures))
  assert.deepEqual(
    canonicalAll(result.molecules),
    canonicalAll([
      "c1ccc(-c2ccccc2)cc1",
      "Fc1ccc(-c2ccccc2)cc1",
      "Clc1ccc(-c2ccccc2)cc1",
      "Fc1ccc(-c2ccccc2)cc1F",
      "Fc1ccc(-c2ccccc2)cc1Cl",
      "Clc1ccc(-c2ccccc2)cc1Cl",
    ]),
  )
})

test("'substituted with 1–2 …' leaves the bare member out; the members are named by what they carry", () => {
  const names = representativesOf(aryl({ substituted: true, substituents: { from: ["F"], min: 1, max: 2 } })).map((choice) => (choice.kind === "fragment" ? choice.name : choice.kind === "label" ? choice.text : choice.kind))
  assert.deepEqual(names, ["Ph（F）", "Ph（F、F）"])
})

test("substituent constraints are checked", () => {
  for (const [constraint, message] of [
    [{ from: [], min: 0, max: 2 }, /which groups/],
    [{ from: ["Xyz"], min: 0, max: 2 }, /not an element or a known abbreviation/],
    [{ from: ["F"], min: 3, max: 1 }, /range/],
    [{ from: ["F"], min: 0, max: 9 }, /range/],
  ] as const) {
    assert.match(alternativeProblem(aryl({ substituents: constraint as never })) ?? "", message)
  }
  assert.match(alternativeProblem(aryl({ substituted: false })) ?? "", /unsubstituted/)
  assert.equal(alternativeProblem(aryl()), null)
})
