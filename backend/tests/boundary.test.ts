import assert from "node:assert/strict"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { forbiddenImports } from "@structura/testkit/arch"

const SRC = fileURLToPath(new URL("../src/", import.meta.url))

test("the backend uses only markush (its one dependency), node builtins and its own files", () => {
  const allowed = (spec: string) => spec.startsWith(".") || spec.startsWith("node:") || spec === "@structura/markush" || spec.startsWith("@structura/markush/")
  assert.deepEqual(forbiddenImports(SRC, allowed), [])
})
