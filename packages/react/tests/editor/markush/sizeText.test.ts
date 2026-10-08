import assert from "node:assert/strict"
import test from "node:test"
import { countText, sizeText } from "../../../src/editor/markush/sizeText.ts"

test("library sizes read naturally, small or huge", () => {
  assert.equal(countText(73), "73")
  assert.equal(countText(12345), "12,345")
  assert.equal(countText(2_300_000), "2.3 × 10⁶")
})

test("the panel says how many combinations, and that classes count only by their representatives", () => {
  const plain = sizeText({ combinations: 73, represented: {}, classesLeftOut: {}, onlyClasses: [] })
  assert.deepEqual(plain, { headline: "可展开为 73 种组合", notes: [] })
  const withClass = sizeText({ combinations: 778, represented: { R1: [{ kind: "label", text: "Me" }] }, classesLeftOut: {}, onlyClasses: [] })
  assert.equal(withClass.headline, "可展开为 778 种组合")
  assert.match(withClass.notes[0], /^R1 的基团类别按代表结构计.*实际范围更大$/)
  assert.equal(sizeText({ combinations: 0, represented: {}, classesLeftOut: {}, onlyClasses: ["R2"] }).headline, "还不能计数")
})
