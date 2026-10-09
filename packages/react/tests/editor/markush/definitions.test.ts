import assert from "node:assert/strict"
import test from "node:test"
import type { Op } from "@structura/core/ops"
import { build, label } from "@structura/testkit"
import { drawingCdxml } from "../../../src/editor/cdxml.ts"
import { definitionLines } from "../../../src/editor/markush/definitions.ts"

const FORMULA: Op[] = [
  { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
  { op: "add_atom", el: "C", as: "r" },
  { op: "label", atom: "r", text: "R1" },
  { op: "move", atoms: ["r"], dx: 110, dy: -70 },
  { op: "set_attachment", atom: "r", to: [1, 2, 3, 4, 5, 6], repeat: { min: 0, max: 3, name: "m" } },
  { op: "add_atom", el: "C", to: 4, as: "c" },
  { op: "add_atom", el: "C", to: "c", as: "x" },
  { op: "label", atom: "x", text: "R2" },
  { op: "add_bracket", atoms: ["c"], kind: "repeat" },
  { op: "set_variable", name: "R1", alternatives: [label("H"), label("Cl"), { kind: "class", class: "alkyl", min: 1, max: 6 }] },
  { op: "set_variable", name: "R2", sameAs: "R1" },
]

test("an ordinary drawing has no definitions", () => {
  assert.deepEqual(definitionLines(build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }])), [])
})

test("each variable's alternatives, then the counts, as a claim lists them", () => {
  assert.deepEqual(definitionLines(build(FORMULA)), ["R1 = H、Cl、取代或未取代的(C1–C6)烷基", "R2 = 同 R1", "m = 0–3", "n = 1–4"])
})

test("the same count written twice is listed once; a fixed count is one number", () => {
  const drawing = build([
    { op: "draw_chain", points: [{ x: 0, y: 0 }, { x: 35, y: -20 }, { x: 70, y: 0 }, { x: 105, y: -20 }, { x: 140, y: 0 }, { x: 175, y: -20 }] },
    { op: "add_bracket", atoms: [2], kind: "repeat", repeat: { min: 2, max: 2, name: "p" } },
    { op: "add_bracket", atoms: [4], kind: "repeat", repeat: { min: 2, max: 2, name: "p" } },
  ])
  assert.deepEqual(definitionLines(drawing), ["p = 2"])
})

test("the exported ChemDraw file carries the definitions under the structure", () => {
  const text = drawingCdxml(build(FORMULA), true)
  for (const line of definitionLines(build(FORMULA))) assert.ok(text.includes(`>${line}</s>`), line)
  assert.match(text, /GenericNickname="R1">\s*<t[^>]*><s[^>]*>\(R<\/s><s[^>]*face="64">1<\/s>/, "R¹ raised, as the canvas shows it with raised numbers")
})
