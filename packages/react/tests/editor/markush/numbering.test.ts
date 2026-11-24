import assert from "node:assert/strict"
import test from "node:test"
import { plainFormula } from "@structura/core/formula"
import { emptyDrawing } from "@structura/core/drawing"
import { applyOps, type Op } from "@structura/core/ops"
import type { Drawing } from "@structura/core/types"
import { assignNumbers, enumerate } from "@structura/markush"
import { DEFAULT_NUMBERING, numberByBook, rowKeyer, rowKeys } from "../../../src/editor/markush/numbering.ts"
import { rowsOf } from "../../../src/editor/markush/results.ts"

/** Benzene with an R1 that may be each of `choices`. */
function benzene(choices: string[], extra: Op[] = []): Drawing {
  const built = applyOps(emptyDrawing(), [
    { op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" },
    { op: "add_atom", el: "C", to: 1, as: "r" },
    { op: "label", atom: "r", text: "R1" },
    { op: "set_variable", name: "R1", alternatives: choices.map((text) => ({ kind: "label" as const, text })) },
    ...extra,
  ])
  assert.ok(built.ok)
  return built.drawing
}

/** What the page does: key the compounds (here by formula, for a stand-in of the canonical SMILES) and number them by the book. */
function numbered(drawing: Drawing, book = DEFAULT_NUMBERING as Drawing["numbering"] & object) {
  const rows = rowsOf(enumerate(drawing))
  const keys = rowKeys(rows, (mol) => plainFormula(mol))
  return { keys, ...numberByBook(rows, keys, book), rows: numberByBook(rows, keys, book).rows.map((row) => [row.id, plainFormula(row.mol)]) }
}

test("a compound keeps its number when candidates are added in front of it, and new ones follow", () => {
  const first = numbered(benzene(["Cl", "F"]))
  assert.deepEqual(first.rows, [["C-1", "C6H5Cl"], ["C-2", "C6H5F"]])
  const book = assignNumbers(DEFAULT_NUMBERING, first.keys)
  // "Br" now comes first in the list; the compounds already numbered do not move.
  const second = numbered(benzene(["Br", "Cl", "F"]), book)
  assert.deepEqual(second.rows, [["C-3", "C6H5Br"], ["C-1", "C6H5Cl"], ["C-2", "C6H5F"]])
  assert.equal(second.fresh, 1)
  // A compound that is gone keeps its number taken: the next new one goes after it.
  const gone = numbered(benzene(["F", "I"]), assignNumbers(book, second.keys))
  assert.deepEqual(gone.rows, [["C-2", "C6H5F"], ["C-4", "C6H5I"]])
})

test("what is shown is what pinning writes: the same numbers, filtered or not", () => {
  const shown = numbered(benzene(["Cl", "F", "Br"]))
  const written = assignNumbers(DEFAULT_NUMBERING, shown.keys)
  assert.deepEqual(shown.keys.map((key) => written.assigned![key]), [1, 2, 3])
  const again = numbered(benzene(["Cl", "F", "Br"]), written)
  assert.equal(again.fresh, 0)
  assert.deepEqual(again.rows, shown.rows)
})

test("the number is written by the pattern, from the start the book has", () => {
  const rows = numbered(benzene(["Cl", "F"]), { pattern: "化合物{n}", start: 5 }).rows
  assert.deepEqual(rows.map(([id]) => id), ["化合物5", "化合物6"])
})

test("without canonical SMILES compounds are told apart by their choices, and a repeat gets its own key", () => {
  const rows = rowsOf(enumerate(benzene(["Cl", "F"])))
  const keys = rowKeys(rows)
  assert.deepEqual(keys, ["p:R1=Cl", "p:R1=F"])
  assert.ok(keys.every((key) => key.startsWith("p:")))
  const twice = rowKeys([rows[0], rows[0]])
  assert.deepEqual(twice, ["p:R1=Cl", "p:R1=Cl#2"])
  // With SMILES, a compound is named by its structure whatever the candidate was called.
  assert.deepEqual(rowKeys(rows, () => "c1ccccc1"), ["s:c1ccccc1", "s:c1ccccc1#2"])
})

test("导出全部 keys compounds one by one exactly as the page keys the list, repeats included", () => {
  const rows = rowsOf(enumerate(benzene(["Cl", "F"])))
  const list = [rows[0], rows[1], rows[0], rows[0]]
  const key = rowKeyer()
  assert.deepEqual(list.map((row) => key(row, null)), rowKeys(list))
  assert.deepEqual(rowKeys(list), ["p:R1=Cl", "p:R1=F", "p:R1=Cl#2", "p:R1=Cl#3"])
  const bySmiles = rowKeyer()
  assert.deepEqual(list.map((row) => bySmiles(row, plainFormula(row.mol))), rowKeys(list, (mol) => plainFormula(mol)))
})
