import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { forbiddenImports } from "@structura/testkit/arch"

const SRC = fileURLToPath(new URL("../../src/", import.meta.url))

test("the guide uses only core, markush, React and the UI kit: never the editor", () => {
  const allowed = (spec: string) => spec.startsWith(".") || spec === "react" || spec.startsWith("@structura/core") || spec === "@structura/markush" || spec.startsWith("@/components/")
  assert.deepEqual(forbiddenImports(join(SRC, "guide"), allowed), [])
})

test("the editor reaches the guide only through its entry, @/guide", () => {
  assert.deepEqual(forbiddenImports(join(SRC, "editor"), (spec) => !spec.startsWith("@/guide/")), [])
})

test("every page file is listed once, with its own id (pages are .tsx, so read as text)", () => {
  const dir = join(SRC, "guide", "pages")
  const files = readdirSync(dir).filter((name) => name.endsWith(".tsx"))
  const index = readFileSync(join(dir, "index.ts"), "utf8")
  const ids = files.map((name) => /\bid: "([\w-]+)"/.exec(readFileSync(join(dir, name), "utf8"))?.[1])
  assert.equal(new Set(ids).size, files.length, "ids are unique")
  for (const name of files) {
    const page = `${name.replace(".tsx", "")}Page`
    assert.ok(index.includes(`import { ${page} } from "./${name}"`) && new RegExp(`\\b${page}\\b[,\\]]`).test(index), `${name} is listed in pages/index.ts`)
  }
})
