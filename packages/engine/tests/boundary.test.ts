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

test("no CSS cursors: which cursor a handle shows is the screen's choice", () => {
  const cursors = sources(SRC).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(/["'`](grab|grabbing|crosshair|not-allowed|wait|zoom-in|zoom-out|[a-z]+-resize)["'`]/g)].map((match) => `${relative(SRC, file)}: ${match[1]}`),
  )
  assert.deepEqual(cursors, [])
})

test("Chinese words live in i18n/zh.ts only", () => {
  // markush/capture.ts keeps its messages until they move into zh.ts too.
  const allowed = new Set(["i18n/zh.ts", "markush/capture.ts"])
  const worded = sources(SRC)
    .filter((file) => !allowed.has(relative(SRC, file).split("\\").join("/")))
    .filter((file) => /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/.test(readFileSync(file, "utf8")))
    .map((file) => relative(SRC, file))
  assert.deepEqual(worded, [])
})

test("no .tsx: the engine draws nothing", () => {
  const drawn = readdirSync(SRC, { recursive: true }).filter((name) => String(name).endsWith(".tsx"))
  assert.deepEqual(drawn, [])
})
