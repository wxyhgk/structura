import assert from "node:assert/strict"
import test from "node:test"
import { describeAlternative } from "../../../src/editor/markush/describe.ts"

test("alternatives read the way a claim puts them", () => {
  assert.equal(describeAlternative({ kind: "label", text: "CN" }), "CN")
  assert.equal(describeAlternative({ kind: "class", class: "alkyl", min: 1, max: 30 }), "取代或未取代的(C1–C30)烷基")
  assert.equal(describeAlternative({ kind: "class", class: "heteroaryl", min: 3, max: 30 }), "取代或未取代的(3–30 元)杂芳基")
  assert.equal(describeAlternative({ kind: "class", class: "silyl", substituted: false }), "未取代的甲硅烷基")
  assert.equal(describeAlternative({ kind: "bond" }), "单键")
  assert.equal(describeAlternative({ kind: "bridge", name: "p-phenylene" }), "对亚苯基")
  assert.equal(describeAlternative({ kind: "class", class: "heteroarylene", min: 3, max: 30 }), "取代或未取代的(3–30 元)亚杂芳基")
})
