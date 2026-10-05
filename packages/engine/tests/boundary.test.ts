import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const SRC = fileURLToPath(new URL("../src/", import.meta.url))

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? sources(path) : entry.name.endsWith(".ts") ? [path] : []
  })
}

test("the engine uses only core, markush and its own files: no React, no editor, no browser", () => {
  const problems = sources(SRC).flatMap((file) => {
    const text = readFileSync(file, "utf8")
    const imports = [...text.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1])
    const outside = imports.filter((spec) => !spec.startsWith(".") && !spec.startsWith("@structura/core") && spec !== "@structura/markush")
    const browser = [...text.matchAll(/\b(document|window|navigator|localStorage)\./g)].map((match) => match[0])
    return [...outside, ...browser].map((what) => `${relative(SRC, file)}: ${what}`)
  })
  assert.deepEqual(problems, [])
})

test("no .tsx: the engine draws nothing", () => {
  const drawn = readdirSync(SRC, { recursive: true }).filter((name) => String(name).endsWith(".tsx"))
  assert.deepEqual(drawn, [])
})
