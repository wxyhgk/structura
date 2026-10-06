import assert from "node:assert/strict"
import test from "node:test"
import type { Enumeration } from "@structura/markush"
import { emptyMolecule } from "@structura/core/molecule"
import { choiceName } from "../../../src/editor/markush/describe.ts"
import { notesOf } from "../../../src/editor/markush/notes.ts"

const label = (text: string) => ({ kind: "label" as const, text })
/** How the panel names a label, so these notes follow its wording. */
const named = (text: string) => choiceName(label(text))

function result(made: number, more: Partial<Enumeration> = {}): Enumeration {
  return {
    molecules: Array.from({ length: made }, () => emptyMolecule()),
    picks: Array.from({ length: made }, () => []),
    total: made,
    occupied: 0,
    classesLeftOut: {},
    represented: {},
    misfits: {},
    undefinedNames: [],
    onlyClasses: [],
    failures: [],
    failed: 0,
    duplicates: 0,
    formulas: 1,
    formulaOf: Array.from({ length: made }, () => 1),
    excluded: 0,
    uncheckedCompounds: 0,
    ...more,
  }
}

test("a complete run with nothing left out has nothing to say", () => {
  assert.deepEqual(notesOf(result(12), { limit: 500 }), [])
})

test("stand-ins, misfits, missing lists and failures are each explained", () => {
  const notes = notesOf(
    result(3, {
      total: 4,
      represented: { R1: [label("Me"), label("Et")] },
      misfits: { L: [label("Ph")] },
      classesLeftOut: { R2: 1 },
      undefinedNames: ["R9"],
      failures: [{ choice: [{ name: "L", position: "R2" }, { name: "R1", choice: label("Me") }], error: "bad valence" }],
      failed: 1,
    }),
    { limit: 500 },
  )
  assert.deepEqual(notes, [
    `R1 的基团类别用代表结构展开：${named("Me")}、${named("Et")}。`,
    `L 所在的位置放不下 ${named("Ph")}，这些已跳过（链末端只能接一价基团，环里只能是元素，连接基只能是单键、亚芳基或 O、S 这类原子）。`,
    "R2 有 1 个基团类别没有展开，只用了具体候选项。",
    "R9 还没有候选项，生成的结构里保留为占位符。",
    `1 种组合没能生成，例如 L 连在 R2 位置，R1 = ${named("Me")}（bad valence）。`,
  ])
})

test("a run cut short says whether the limit or the user stopped it", () => {
  assert.deepEqual(notesOf(result(100, { total: 3000 }), { limit: 100 }), ["组合太多，只生成了前 100 种。"])
  assert.deepEqual(notesOf(result(40, { total: 3000 }), { limit: 100, status: "running" }), [], "still going: nothing is cut short yet")
  assert.deepEqual(notesOf(result(42, { total: 3000 }), { limit: 500, status: "stopped" }), ["已停止生成，只生成了前 42 种。"])
  assert.deepEqual(notesOf(result(500, { total: 500 }), { limit: 500, status: "stopped" }), [], "stopped after the last one: nothing is missing")
})
