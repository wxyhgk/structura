import assert from "node:assert/strict"
import test from "node:test"
import { matchScaffolds } from "../../../src/editor/canvas/scaffoldSearch.ts"

test("templates are found by English or Chinese name, names that start with it first", () => {
  assert.equal(matchScaffolds("咔唑")[0].name, "carbazole")
  assert.equal(matchScaffolds("carb")[0].name, "carbazole")
  assert.deepEqual(matchScaffolds("thio").map((item) => item.name), ["thiophene", "benzothiophene", "dibenzothiophene"])
  assert.ok(matchScaffolds("呋喃").some((item) => item.name === "dibenzofuran"))
  assert.equal(matchScaffolds("").length, 25)
  assert.deepEqual(matchScaffolds("xyz"), [])
})
