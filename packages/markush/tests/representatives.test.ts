import assert from "node:assert/strict"
import test from "node:test"
import { choiceText, REPRESENTATIVES } from "@structura/markush"

test("every representative has a Chinese name, and no two share a label", () => {
  const all = Object.values(REPRESENTATIVES).flat()
  for (const item of all) assert.ok(item.zh.trim().length > 0, `${choiceText(item.choice)} has no Chinese name`)
  const texts = all.map((item) => choiceText(item.choice))
  assert.equal(new Set(texts).size, texts.length)
})
