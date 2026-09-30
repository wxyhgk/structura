import assert from "node:assert/strict"
import test from "node:test"
import { describeAlternative, parseLabels } from "../../../src/editor/markush/describe.ts"

test("alternatives read the way a claim puts them", () => {
  assert.equal(describeAlternative({ kind: "label", text: "CN" }), "CN")
  assert.equal(describeAlternative({ kind: "class", class: "alkyl", min: 1, max: 30 }), "取代或未取代的(C1–C30)烷基")
  assert.equal(describeAlternative({ kind: "class", class: "heteroaryl", min: 3, max: 30 }), "取代或未取代的(3–30 元)杂芳基")
  assert.equal(describeAlternative({ kind: "class", class: "silyl", substituted: false }), "未取代的甲硅烷基")
})

test("typed labels split on commas and spaces, and 卤素 means the four halogens", () => {
  assert.deepEqual(parseLabels("H, D，卤素、CN  Me"), ["H", "D", "F", "Cl", "Br", "I", "CN", "Me"])
  assert.deepEqual(parseLabels(" F, F "), ["F"])
  assert.deepEqual(parseLabels(""), [])
})
