import assert from "node:assert/strict"
import test from "node:test"
import { ELEMENTS } from "@structura/core/elements"
import { TOOL_KEYS, toolForKey, toolKeyLabel } from "@structura/engine"

function describe(key: string): string {
  const entry = toolForKey(key)
  if (!entry) return "none"
  if (entry.tool === "bond") return `bond ${entry.style.order}${entry.style.stereo === "none" ? "" : ` ${entry.style.stereo}`}`
  if (entry.tool === "ring") return `ring ${entry.ring}`
  return entry.tool
}

test("tool keys pick the expected tools", () => {
  assert.equal(describe("x"), "bond 1")
  assert.equal(describe("X"), "bond 1")
  assert.equal(describe("j"), "ring benzene")
  assert.equal(describe("a"), "ring benzene")
  assert.equal(describe("w"), "bond 1 up")
  assert.equal(describe("W"), "bond 1 down")
  assert.equal(describe("y"), "bond 1 either")
  assert.equal(describe("z"), "bond 3")
  assert.equal(describe("t"), "ring cyclopropane")
  assert.equal(describe("6"), "ring cyclohexane")
  assert.equal(describe("8"), "ring cyclooctane")
  assert.equal(describe("V"), "lasso")
  assert.equal(describe("q"), "none")
})

test("every key means one thing and none shadows an element shortcut", () => {
  const keys = TOOL_KEYS.map((entry) => entry.key)
  assert.equal(new Set(keys).size, keys.length)
  const elementKeys = new Set(ELEMENTS.flatMap((element) => (element.shortcut ? [element.shortcut] : [])))
  assert.deepEqual(keys.filter((key) => elementKeys.has(key.toLowerCase())), [])
})

test("each tool key is named as the palette names its tool", () => {
  const named = Object.fromEntries(TOOL_KEYS.map((entry) => [entry.key, toolKeyLabel(entry)]))
  assert.deepEqual(named, {
    v: "套索", m: "框选", k: "碳链", e: "橡皮",
    b: "单键", x: "单键", 1: "单键", 2: "双键", 3: "三键", z: "三键", w: "楔形键", W: "虚楔键", y: "波浪键",
    r: "环（上次的种类）", j: "苯", a: "苯", t: "环丙烷", 4: "环丁烷", 5: "环戊烷", 6: "环己烷", 7: "环庚烷", 8: "环辛烷",
    "[": "方括号",
  })
})
