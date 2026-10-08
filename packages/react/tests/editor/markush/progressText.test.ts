import assert from "node:assert/strict"
import test from "node:test"
import type { Enumeration } from "@structura/markush"
import { emptyMolecule } from "@structura/core/molecule"
import { progressText } from "../../../src/editor/markush/progressText.ts"

const made = (count: number, more: Partial<Enumeration> = {}) => ({ molecules: Array.from({ length: count }, () => emptyMolecule()), total: count, duplicates: 0, ...more }) as Enumeration

test("before the first slice it says it is generating, or that there is nothing", () => {
  assert.equal(progressText({ result: null, status: "running" }, 500), "正在生成…")
  assert.equal(progressText({ result: null, status: "done" }, 500), "没有可以生成的化合物。")
})

test("while running it counts up to the total or the limit, whichever is smaller", () => {
  assert.equal(progressText({ result: made(3, { total: 900 }), status: "running" }, 500), "正在生成：已生成 3 / 共 500…")
  assert.equal(progressText({ result: made(3, { total: 40 }), status: "running" }, 500), "正在生成：已生成 3 / 共 40…")
})

test("once done it says what was made, the repeats merged, how many are drawn and whether it was stopped", () => {
  assert.equal(progressText({ result: made(0), status: "done" }, 500), "没有可以生成的化合物。")
  assert.equal(progressText({ result: made(12), status: "done" }, 500), "共 12 种组合，得到 12 个化合物。")
  assert.equal(progressText({ result: made(5, { total: 9, duplicates: 4 }), status: "done" }, 500), "共 9 种组合，得到 5 个不同的化合物（合并了 4 个重复的）。")
  assert.equal(progressText({ result: made(150), status: "done" }, 500, 120), "共 150 种组合，得到 150 个化合物，下面显示前 120 个。")
  assert.equal(progressText({ result: made(150), status: "done" }, 500), "共 150 种组合，得到 150 个化合物。")
  assert.equal(progressText({ result: made(7, { total: 30 }), status: "stopped" }, 500), "共 30 种组合，得到 7 个化合物（已停止）。")
})
