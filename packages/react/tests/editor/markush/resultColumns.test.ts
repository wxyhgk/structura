import assert from "node:assert/strict"
import test from "node:test"
import type { Pick } from "@structura/markush"
import { build } from "@structura/testkit"
import { columnsOf, cellText, sortRows, valueOrder } from "../../../src/editor/markush/resultColumns.ts"
import type { Row } from "../../../src/editor/markush/results.ts"

const mol = (...els: string[]) => build([{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }, ...els.map((el, index) => ({ op: "add_atom" as const, el, to: index + 1 }))]).molecule
const take = (r1: string, at?: string): Pick[] => [...(at ? [{ name: "R1", position: at }] : []), { name: "R1", choice: { kind: "label", text: r1 } }]

// Candidates in the order Cl, F, Me; the compounds come out in that order, one of them without R1 at all.
const rows: Row[] = [
  { number: 1, mol: mol("Cl", "Cl"), picks: take("Cl", "#1") },
  { number: 2, mol: mol("F"), picks: take("F", "#1") },
  { number: 3, mol: mol("C"), picks: take("Me", "#1") },
  { number: 4, mol: mol(), picks: [{ name: "R1", position: "none" }] },
]

test("the table has a column for the number, each variable (and where it went), the formula and the properties", () => {
  const columns = columnsOf(rows)
  assert.deepEqual(columns.map((column) => column.id), ["number", "v:R1", "p:R1", "formula", "prop:mw", "prop:exact", "prop:logp", "prop:tpsa", "prop:hbd", "prop:hba", "prop:rotb", "prop:heavy"])
  assert.equal(columnsOf(rows.map((row) => ({ ...row, formula: 1 })))[1].id, "which", "a column for the drawn formula only when there are several")
  assert.equal(cellText(columns[1], rows[0], undefined), "Cl")
  assert.equal(cellText(columns[2], rows[3], undefined), "不出现")
  assert.equal(cellText(columns[4], rows[2], undefined), "92.14")
  assert.equal(cellText(columns[6], rows[2], undefined), "", "an RDKit property is empty until computed")
  assert.equal(cellText(columns[6], rows[2], { logp: 2.34, tpsa: 0, hbd: 0, hba: 0, rotb: 0, heavy: 7 }), "2.34")
})

test("a variable's column sorts by the order of its candidates, rows without it last either way", () => {
  const columns = columnsOf(rows)
  const context = { order: valueOrder(rows), props: () => undefined }
  const ids = (sort: Parameters<typeof sortRows>[1]) => sortRows(rows, sort, columns, context).map((row) => row.number)
  assert.deepEqual(ids({ column: "v:R1", descending: false }), [1, 2, 3, 4])
  assert.deepEqual(ids({ column: "v:R1", descending: true }), [3, 2, 1, 4], "not alphabetical: Cl, F, Me are the candidates' order")
  assert.deepEqual(ids(null), [1, 2, 3, 4])
})

test("numbers sort as numbers, and what has no number goes last", () => {
  const columns = columnsOf(rows)
  const context = { order: valueOrder(rows), props: () => undefined }
  const byWeight = (descending: boolean) => sortRows(rows, { column: "prop:mw", descending }, columns, context).map((row) => row.number)
  // Weights: benzene 78 (compound 4), fluorobenzene 96, toluene 92, 1,2-dichlorobenzene-ish 147.
  assert.deepEqual(byWeight(false), [4, 3, 2, 1])
  assert.deepEqual(byWeight(true), [1, 2, 3, 4])
  const logp = new Map([[rows[0].mol, { logp: 3, tpsa: 0, hbd: 0, hba: 0, rotb: 0, heavy: 8 }], [rows[1].mol, { logp: 2, tpsa: 0, hbd: 0, hba: 0, rotb: 0, heavy: 7 }]])
  const byLogp = (descending: boolean) => sortRows(rows, { column: "prop:logp", descending }, columns, { order: new Map(), props: (m) => logp.get(m) }).map((row) => row.number)
  assert.deepEqual(byLogp(false), [2, 1, 3, 4], "compounds RDKit has no value for are last")
  assert.deepEqual(byLogp(true), [1, 2, 3, 4])
})
