import assert from "node:assert/strict"
import test from "node:test"
import type { Pick } from "@structura/markush"
import { build } from "@structura/testkit"
import type { Row } from "../../src/page/results.ts"
import { filterRows, keepInRanges, keepMatching, NO_FILTER, parseWords, ruleOfFiveBreaks, unknownVariables, type RowFilter } from "../../src/page/rowFilter.ts"

const mol = (...els: string[]) => build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }, ...els.map((el, index) => ({ op: "add_atom" as const, el, to: index + 1 }))]).molecule
const take = (r1: string, extra: Pick[] = []): Pick[] => [{ name: "R1", choice: { kind: "label", text: r1 } }, ...extra]

// Benzene with one H, one Hex..., then Cl, Na-bearing, N2 and so on, to tell the filters apart.
const rows: Row[] = [
  { number: 1, mol: mol(), picks: take("H") },
  { number: 2, mol: mol("N"), picks: take("Hex") },
  { number: 3, mol: mol("Cl"), picks: take("Cl") },
  { number: 4, mol: mol("Na"), picks: take("Na") },
  { number: 5, mol: build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }, { op: "add_atom", el: "N", to: 1 }, { op: "add_atom", el: "N", to: 2 }]).molecule, picks: take("OMe", [{ name: "n", count: 2 }]) },
]
const numbers = (text: string) => filterRows(rows, text).map((row) => row.number)

test("R1=H holds only compounds where R1 became H, not Hex", () => {
  assert.deepEqual(numbers("R1=H"), [1])
  assert.deepEqual(numbers("r1 = h"), [1], "case and spaces around = do not matter")
  assert.deepEqual(numbers("R1=Hex"), [2])
  assert.deepEqual(numbers("R1=H|Cl"), [1, 3], "| lists alternatives")
  assert.deepEqual(numbers("R1!=H"), [2, 3, 4, 5])
  assert.deepEqual(numbers('R1="O Me"'), [5], "spaces inside a value do not matter either")
})

test("several conditions, separated by spaces or commas, all hold", () => {
  assert.deepEqual(numbers("R1=OMe n=2"), [5])
  assert.deepEqual(numbers("R1=OMe, n=3"), [])
  assert.deepEqual(numbers("R1=H, R1=Cl"), [])
})

test("an element alone asks for it, with a number for exactly that many", () => {
  assert.deepEqual(numbers("N"), [2, 5], "N is nitrogen, not the N of Na")
  assert.deepEqual(numbers("N2"), [5])
  assert.deepEqual(numbers("N2+"), [5])
  assert.deepEqual(numbers("N1-"), [1, 2, 3, 4])
  assert.deepEqual(numbers("N0"), [1, 3, 4])
  assert.deepEqual(numbers("Cl"), [3], "Cl is chlorine, not C and l")
  assert.deepEqual(numbers("Na"), [4])
  // Every compound holds carbon, and says so: C is a test of its own, not a substring.
  assert.deepEqual(numbers("C"), [1, 2, 3, 4, 5])
  assert.deepEqual(numbers("C6H7N"), [2])
})

test("words that are no element or condition are free text in the variables' names and values", () => {
  assert.deepEqual(numbers("OMe"), [5])
  assert.deepEqual(numbers("ome"), [5])
  assert.deepEqual(numbers("hex"), [2], "free text may be part of a value")
  assert.deepEqual(numbers("OMe N"), [5], "free text and an element both have to hold")
  assert.deepEqual(numbers("C-3"), [], "a number is found in the compound's number")
  assert.deepEqual(filterRows([{ ...rows[0], id: "C-3" }], "c-3").length, 1)
})

test("formula numbers pick the drawn formula a compound came from", () => {
  const two = rows.map((row, index) => ({ ...row, formula: index < 2 ? 1 : 2 }))
  assert.deepEqual(filterRows(two, "式2").map((row) => row.number), [3, 4, 5])
  assert.deepEqual(filterRows(two, "式1 N").map((row) => row.number), [2])
})

test("the words say what is wrong with them, and which variables do not exist", () => {
  assert.deepEqual(parseWords("R1=").problems.length, 1)
  assert.deepEqual(parseWords("=H").problems.length, 1)
  assert.deepEqual(unknownVariables(parseWords("R9=H R1=H"), ["R1", "R2"]), ["R9"])
  assert.deepEqual(unknownVariables(parseWords("r1=H"), ["R1"]), [])
  assert.deepEqual(numbers("R9=H"), [], "a variable nobody has matches nothing")
})

test("the structure stage keeps the compounds that contain it, and counts the rest", () => {
  const stage = keepMatching(rows, (m) => (m === rows[0].mol ? true : m === rows[1].mol ? false : m === rows[2].mol ? null : undefined))
  assert.deepEqual(stage.rows.map((row) => row.number), [1])
  assert.equal(stage.pending, 2)
  assert.equal(stage.unreadable, 1)
})

test("ranges keep what lies within them, wait for RDKit's numbers and give up on compounds it cannot read", () => {
  const filter: RowFilter = { ...NO_FILTER, ranges: { mw: { min: "", max: "100" }, logp: { min: "1", max: "" } } }
  const props = (m: unknown) => (m === rows[0].mol ? { logp: 1.7, tpsa: 0, hbd: 0, hba: 0, rotb: 0, heavy: 6 } : m === rows[1].mol ? null : undefined)
  const stage = keepInRanges(rows, filter, props as never)
  // Benzene weighs 78 and has cLogP 1.7; compound 2 is unreadable; the others are not computed yet.
  assert.deepEqual(stage.rows.map((row) => row.number), [1])
  assert.equal(stage.unreadable, 1)
  assert.equal(stage.pending, 3)
  // Weight is the formula's: no RDKit is needed to cut on it.
  const light = keepInRanges(rows, { ...NO_FILTER, ranges: { mw: { min: "", max: "100" } } }, () => undefined)
  assert.deepEqual(light.rows.map((row) => row.number), [1, 2], "benzene and aniline")
  assert.equal(light.pending, 0)
})

test("the rule of five allows one broken limit", () => {
  const rd = { logp: 5.5, tpsa: 0, hbd: 0, hba: 0, rotb: 0, heavy: 6 }
  assert.equal(ruleOfFiveBreaks(rows[0].mol, rd), 1)
  assert.equal(ruleOfFiveBreaks(rows[0].mol, { ...rd, hbd: 6 }), 2)
  const kept = keepInRanges(rows.slice(0, 1), { ...NO_FILTER, ruleOfFive: true }, () => ({ ...rd, hbd: 6 }))
  assert.equal(kept.rows.length, 0)
})
