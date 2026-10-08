import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { forbiddenImports } from "@structura/testkit/arch"

const ROOT = fileURLToPath(new URL("../../../", import.meta.url))
const at = (dir: string) => join(ROOT, dir)

test("markush builds on core alone: no engine, editor, React or browser", () => {
  assert.deepEqual(forbiddenImports(at("packages/markush/src"), (spec) => spec.startsWith(".") || spec.startsWith("@structura/core")), [])
})

test("core never reaches up into markush: the dependency runs one way", () => {
  assert.deepEqual(forbiddenImports(at("packages/core/src"), (spec) => !spec.startsWith("@structura/")), [])
})

test("everything else takes generic-formula code from @structura/markush, never core's model directly", () => {
  const users = ["src", "packages/engine/src", "packages/ai/src", "packages/rdkit/src", "backend/src"]
  assert.deepEqual(users.flatMap((dir) => forbiddenImports(at(dir), (spec) => spec !== "@structura/core/markush").map((line) => `${dir}/${line}`)), [])
})
