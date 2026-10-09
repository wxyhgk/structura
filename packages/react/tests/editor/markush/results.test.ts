import assert from "node:assert/strict"
import test from "node:test"
import type { Pick } from "@structura/markush"
import { build } from "@structura/testkit"
import { filterRows, picksText, rowsOf, rowsToCsv, rowsToSmiles, type Row } from "../../../src/editor/markush/results.ts"

const benzene = build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }]).molecule
const chloro = build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }, { op: "add_atom", el: "Cl", to: 1 }]).molecule
const picks = (r1: string, at: string): Pick[] => [
  { name: "R1", position: at },
  { name: "R1", choice: { kind: "label", text: r1 } },
]
const rows: Row[] = [
  { number: 1, mol: benzene, picks: [{ name: "R1", position: "none" }] },
  { number: 2, mol: chloro, picks: picks("Cl", "#2") },
]
const smiles = (mol: Row["mol"]) => (mol === chloro ? "Clc1ccccc1" : "c1ccccc1")

test("what the variables became reads briefly, each name once", () => {
  assert.equal(picksText(picks("Cl", "#2, #4")), "R1 在 #2、#4，R1 = Cl")
  assert.equal(picksText([...picks("Cl", "#2, #4"), { name: "R1", choice: { kind: "label", text: "F" } }]), "R1 在 #2、#4，R1 = Cl、F")
  assert.equal(picksText([{ name: "R1", position: "none" }]), "R1 不出现")
  assert.equal(picksText([{ name: "n", count: 3 }, ...picks("Cl", "#2")]), "R1 在 #2，n = 3，R1 = Cl", "a repeat unit's count reads like a variable")
})

test("the filter keeps rows whose formula or picks hold every word", () => {
  assert.deepEqual(filterRows(rows, "").map((row) => row.number), [1, 2])
  assert.deepEqual(filterRows(rows, "cl").map((row) => row.number), [2])
  assert.deepEqual(filterRows(rows, "R1 = Cl").map((row) => row.number), [2])
  assert.deepEqual(filterRows(rows, "C6H6").map((row) => row.number), [1])
  assert.deepEqual(filterRows(rows, "Br").map((row) => row.number), [])
})

test("CSV and SMILES exports carry number, structure and every variable's value", () => {
  const csv = rowsToCsv(rows, smiles)
  const [head, first, second] = csv.replace(/^﻿/, "").trim().split("\n")
  assert.equal(head, "No,SMILES,Formula,MW,R1 position,R1")
  assert.equal(first, "1,c1ccccc1,C6H6,78.11,none,")
  assert.equal(second, `2,Clc1ccccc1,C6H5Cl,112.56,#2,Cl`)
  assert.equal(rowsToSmiles(rows, smiles), "c1ccccc1\t1\nClc1ccccc1\t2\n")
})

test("with several formulas, each row says which, in the filter and in the exports", () => {
  const two: Row[] = [
    { ...rows[0], formula: 1 },
    { ...rows[1], formula: 2 },
  ]
  assert.deepEqual(filterRows(two, "式2").map((row) => row.number), [2])
  const [head, , second] = rowsToCsv(two, smiles).replace(/^﻿/, "").trim().split("\n")
  // The chemical formula and the number of the drawn formula are different columns.
  assert.equal(head, "No,SMILES,Formula,MW,Formula No,R1 position,R1")
  assert.ok(second.startsWith("2,Clc1ccccc1,C6H5Cl,112.56,2,"))
})

test("provisos read the way a claim states them", async () => {
  const { provisoText } = await import("../../../src/editor/markush/describe.ts")
  const H = { kind: "label" as const, text: "H" }
  assert.equal(provisoText({ kind: "combination", when: [{ name: "R1", is: [H] }, { name: "R2", is: [H, { kind: "label", text: "D" }] }] }), "排除：R1 = H 且 R2 = H 或 D")
  assert.equal(provisoText({ kind: "compound", smiles: "Clc1ccccc1" }), "排除化合物：Clc1ccccc1")
})

test("a class carrying named substituents says so", async () => {
  const { describeAlternative } = await import("../../../src/editor/markush/describe.ts")
  assert.equal(
    describeAlternative({ kind: "class", class: "aryl", min: 6, max: 30, substituents: { from: ["F", "Cl"], min: 0, max: 2 } }),
    "取代或未取代的(C6–C30)芳基（被 0–2 个 F、Cl 取代）",
  )
})

test("an enumeration's compounds become rows numbered from 1, tagged by formula only when there are several", () => {
  const made = { molecules: [benzene, chloro], picks: [rows[0].picks, rows[1].picks], formulaOf: [1, 2] }
  const one = rowsOf({ ...made, formulas: 1 } as unknown as Parameters<typeof rowsOf>[0])
  assert.deepEqual(one.map((row) => [row.number, row.mol, row.formula]), [[1, benzene, undefined], [2, chloro, undefined]])
  assert.equal(one[1].picks, rows[1].picks)
  const two = rowsOf({ ...made, formulas: 2 } as unknown as Parameters<typeof rowsOf>[0])
  assert.deepEqual(two.map((row) => row.formula), [1, 2])
})
