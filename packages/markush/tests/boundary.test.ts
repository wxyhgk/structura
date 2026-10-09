import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join, relative } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { forbiddenImports, sources } from "@structura/testkit/arch"

const ROOT = fileURLToPath(new URL("../../../", import.meta.url))
const at = (dir: string) => join(ROOT, dir)

test("markush builds on core alone: no engine, editor, React or browser", () => {
  assert.deepEqual(forbiddenImports(at("packages/markush/src"), (spec) => spec.startsWith(".") || spec.startsWith("@structura/core")), [])
})

test("core never reaches up into markush: the dependency runs one way", () => {
  assert.deepEqual(forbiddenImports(at("packages/core/src"), (spec) => !spec.startsWith("@structura/")), [])
})

test("everything else takes generic-formula code from @structura/markush, never core's model directly", () => {
  const users = ["src", "packages/react/src", "packages/engine/src", "packages/ai/src", "packages/rdkit/src", "backend/src"]
  assert.deepEqual(users.flatMap((dir) => forbiddenImports(at(dir), (spec) => spec !== "@structura/core/markush").map((line) => `${dir}/${line}`)), [])
})

/** The generic formula's types: core keeps them with its markush model, not with the molecule's. */
const MARKUSH_TYPES = ["Alternative", "Attachment", "BridgeName", "Choice", "GroupClass", "Proviso", "Repeat", "RingClosure", "SizeUnit", "Substituents", "Variable"]

test("everything else takes the generic formula's types from @structura/markush, not core's types", () => {
  const dirs = ["src", "tests", "packages/react/src", "packages/react/tests", "packages/engine/src", "packages/engine/tests", "packages/ai/src", "packages/ai/tests", "packages/rdkit/src", "backend/src", "backend/tests"]
  const named = new RegExp(`\\b(${MARKUSH_TYPES.join("|")})\\b`)
  const offenders = dirs.flatMap((dir) =>
    sources(at(dir)).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*"@structura\/core(?:\/types)?"/g)]
        .filter((match) => named.test(match[1]))
        .map((match) => `${relative(ROOT, file)}: ${match[0].replace(/\s+/g, " ")}`),
    ),
  )
  assert.deepEqual(offenders, [])
})
