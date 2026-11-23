import assert from "node:assert/strict"
import test from "node:test"
import { countText, sizeText, totalText } from "../../../src/editor/markush/sizeText.ts"

test("library sizes read naturally, small or huge", () => {
  assert.equal(countText(73), "73")
  assert.equal(countText(12345), "12,345")
  assert.equal(countText(2_300_000), "2.3 × 10⁶")
  assert.equal(countText(Infinity), "超过 10³⁰⁰")
  assert.equal(totalText(920_000), "920000")
  assert.equal(totalText(60_466_176, true), "约 6.0 × 10⁷")
})

test("an estimated size says approximately", () => {
  const size = { combinations: 120_000, estimated: true, represented: {}, classesLeftOut: {}, onlyClasses: [], skippedRepeats: [], straddlingAttachments: [] }
  assert.equal(sizeText(size).headline, "可展开为约 120,000 种组合")
})

test("the panel says how many combinations, and that classes count only by their representatives", () => {
  const plain = sizeText({ combinations: 73, represented: {}, classesLeftOut: {}, onlyClasses: [], skippedRepeats: [], straddlingAttachments: [] })
  assert.deepEqual(plain, { headline: "可展开为 73 种组合", notes: [] })
  const withClass = sizeText({ combinations: 778, represented: { R1: [{ kind: "label", text: "Me" }] }, classesLeftOut: {}, onlyClasses: [], skippedRepeats: [], straddlingAttachments: [] })
  assert.equal(withClass.headline, "可展开为 778 种组合")
  assert.match(withClass.notes[0], /^R1 的基团类别按代表结构计.*实际范围更大$/)
  const across = sizeText({ combinations: 4, represented: {}, classesLeftOut: {}, onlyClasses: [], skippedRepeats: [], straddlingAttachments: [{ name: "n", bracket: 1, atom: 7, attachment: "R1" }] })
  assert.match(across.notes[0], /^R1 的可变连接跨在重复单元 \[ … \]n 的括号内外/)
  assert.equal(sizeText({ combinations: 0, represented: {}, classesLeftOut: {}, onlyClasses: ["R2"], skippedRepeats: [], straddlingAttachments: [] }).headline, "还不能计数")
})
