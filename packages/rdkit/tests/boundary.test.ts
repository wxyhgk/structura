import assert from "node:assert/strict"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { forbiddenImports } from "@structura/testkit/arch"

const SRC = fileURLToPath(new URL("../src/", import.meta.url))

test("the RDKit bridge uses only core, RDKit and its own files", () => {
  const allowed = (spec: string) => spec.startsWith(".") || spec === "@rdkit/rdkit" || spec === "@structura/core" || spec.startsWith("@structura/core/")
  assert.deepEqual(forbiddenImports(SRC, allowed), [])
})
