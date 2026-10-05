import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const SRC = fileURLToPath(new URL("../src/", import.meta.url))
const CORE = fileURLToPath(new URL("../../core/src/", import.meta.url))

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? sources(path) : entry.name.endsWith(".ts") ? [path] : []
  })
}

const importsOf = (file: string) => [...readFileSync(file, "utf8").matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1])

test("markush builds on core alone: no engine, editor, React or browser", () => {
  const problems = sources(SRC).flatMap((file) =>
    importsOf(file)
      .filter((spec) => !spec.startsWith(".") && !spec.startsWith("@structura/core"))
      .map((spec) => `${relative(SRC, file)}: ${spec}`),
  )
  assert.deepEqual(problems, [])
})

test("core never reaches up into markush: the dependency runs one way", () => {
  const problems = sources(CORE).flatMap((file) => importsOf(file).filter((spec) => spec.startsWith("@structura/")).map((spec) => `${relative(CORE, file)}: ${spec}`))
  assert.deepEqual(problems, [])
})
