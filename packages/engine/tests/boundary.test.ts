import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { relative } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { forbiddenImports, sources } from "@structura/testkit/arch"

const SRC = fileURLToPath(new URL("../src/", import.meta.url))

test("the engine uses only core, markush and its own files: no React, no editor, no browser", () => {
  const outside = forbiddenImports(SRC, (spec) => spec.startsWith(".") || spec.startsWith("@structura/core") || spec === "@structura/markush")
  const browser = sources(SRC).flatMap((file) => [...readFileSync(file, "utf8").matchAll(/\b(document|window|navigator|localStorage)\./g)].map((match) => `${relative(SRC, file)}: ${match[0]}`))
  const problems = [...outside, ...browser]
  assert.deepEqual(problems, [])
})

test("no .tsx: the engine draws nothing", () => {
  const drawn = readdirSync(SRC, { recursive: true }).filter((name) => String(name).endsWith(".tsx"))
  assert.deepEqual(drawn, [])
})
