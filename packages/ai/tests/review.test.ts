import assert from "node:assert/strict"
import test from "node:test"
import type { Drawing } from "@structura/core/types"
import { requestFor } from "../src/request.ts"
import { fillOps, reviewAnswer } from "../src/review.ts"
import type { FillAnswer, FillRequest } from "../src/types.ts"

const request: FillRequest = {
  text: "…",
  variables: [
    { name: "R1", linker: false, onDrawing: true, current: null },
    { name: "R2", linker: false, onDrawing: true, current: { alternatives: [{ kind: "label", text: "H" }] } },
    { name: "X", linker: false, onDrawing: true, current: null },
    { name: "L", linker: true, onDrawing: true, current: null },
    { name: "R9", linker: false, onDrawing: true, current: null },
  ],
}

const answer: FillAnswer = {
  variables: [
    {
      name: "R1",
      source: "R1 选自 H、卤素、取代或未取代的 C1-C30 烷基",
      sameAs: null,
      alternatives: [
        { kind: "label", text: "H" },
        { kind: "label", text: "halogen" },
        { kind: "label", text: "Cl" },
        { kind: "class", class: "alkyl", min: 1, max: 30, substituted: null },
        { kind: "label", text: "金刚烷基" },
      ],
      unrepresented: ["取代基选自卤素、氰基"],
    },
    { name: "R2", source: "R2 与 R1 相同", sameAs: "R1", alternatives: [], unrepresented: [] },
    { name: "X", source: "X 为 O 或 S", sameAs: null, alternatives: [{ kind: "label", text: "O" }, { kind: "label", text: "S" }], unrepresented: [] },
    {
      name: "L",
      source: "L 为单键或 C6-C30 亚芳基",
      sameAs: null,
      alternatives: [{ kind: "bond" }, { kind: "class", class: "arylene", min: 6, max: 30, substituted: null }, { kind: "bridge", name: "o-phenylene" }],
      unrepresented: [],
    },
    { name: "R5", source: "R5 与 R7 相同", sameAs: "R7", alternatives: [], unrepresented: [] },
  ],
  notes: ["X 也可能包括 NH，按原文只取 O、S。"],
}

test("an answer is checked: unknown labels and bridges are dropped with why, halogen is four labels", () => {
  const review = reviewAnswer(answer, request)
  const [r1, r2, x, l, r5] = review.variables
  assert.deepEqual(r1.variable, {
    alternatives: [
      { kind: "label", text: "H" },
      { kind: "label", text: "F" },
      { kind: "label", text: "Cl" },
      { kind: "label", text: "Br" },
      { kind: "label", text: "I" },
      { kind: "class", class: "alkyl", min: 1, max: 30 },
    ],
  })
  assert.deepEqual(r1.rejected, [{ text: "金刚烷基", why: "不是元素或已知缩写" }])
  assert.deepEqual(r1.unrepresented, ["取代基选自卤素、氰基"])
  assert.equal(r1.replaces, false)
  assert.deepEqual(r2.variable, { sameAs: "R1" })
  assert.equal(r2.replaces, true)
  assert.deepEqual(x.variable, { alternatives: [{ kind: "label", text: "O" }, { kind: "label", text: "S" }] })
  assert.deepEqual(l.variable, { alternatives: [{ kind: "bond" }, { kind: "class", class: "arylene", min: 6, max: 30 }] })
  assert.equal(l.rejected.length, 1)
  assert.deepEqual(l.warnings, [])
  assert.equal(r5.variable, null, "a same-as pointing at nothing is dropped")
  assert.deepEqual(r5.warnings, ["图上没有这个变量"])
  assert.deepEqual(review.notes, ["X 也可能包括 NH，按原文只取 O、S。", "文字里没有找到 R9 的定义。"])
})

test("a substituent given a bond, or a linker given a substituent, is flagged", () => {
  const review = reviewAnswer(
    {
      variables: [
        { name: "R1", source: "", sameAs: null, alternatives: [{ kind: "bond" }, { kind: "label", text: "Me" }], unrepresented: [] },
        { name: "L", source: "", sameAs: null, alternatives: [{ kind: "label", text: "Me" }], unrepresented: [] },
      ],
      notes: [],
    },
    request,
  )
  assert.equal(review.variables[0].warnings.length, 1)
  assert.equal(review.variables[1].warnings.length, 1)
})

test("the chosen variables become ops, lists before what shares them", () => {
  const review = reviewAnswer(answer, request)
  const { ops, skipped } = fillOps(review, new Set(["R2", "R1", "X"]), { R2: { alternatives: [{ kind: "label", text: "H" }] } })
  assert.deepEqual(
    ops.map((op) => ("name" in op ? op.name : op.op)),
    ["R1", "X", "R2"],
  )
  assert.deepEqual(skipped, [])
})

test("sharing a list that is neither chosen nor defined is skipped, with why", () => {
  const review = reviewAnswer(answer, request)
  const { ops, skipped } = fillOps(review, new Set(["R2"]))
  assert.deepEqual(ops, [])
  assert.equal(skipped[0].name, "R2")
})

test("the request lists the drawing's variables, where they sit and what they are now", () => {
  const drawing = {
    molecule: {
      atoms: [
        { id: 1, el: "C", x: 0, y: 0, alias: "R1" },
        { id: 2, el: "C", x: 1, y: 0 },
        { id: 3, el: "C", x: 2, y: 0, alias: "L" },
        { id: 4, el: "C", x: 3, y: 0 },
      ],
      bonds: [
        { id: 1, a: 1, b: 2, order: 1 },
        { id: 2, a: 2, b: 3, order: 1 },
        { id: 3, a: 3, b: 4, order: 1 },
      ],
      groups: [],
      nextAtomId: 5,
      nextBondId: 4,
      nextGroupId: 1,
    },
    arrows: [],
    nextArrowId: 1,
    variables: { R7: { alternatives: [{ kind: "label" as const, text: "H" }] } },
  } as unknown as Drawing
  assert.deepEqual(requestFor(drawing, "t").variables, [
    { name: "R1", linker: false, onDrawing: true, current: null },
    { name: "L", linker: true, onDrawing: true, current: null },
    { name: "R7", linker: false, onDrawing: false, current: { alternatives: [{ kind: "label", text: "H" }] } },
  ])
})
