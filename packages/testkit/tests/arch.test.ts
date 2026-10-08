import assert from "node:assert/strict"
import { writeFileSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { forbiddenImports, importsOf } from "../src/arch.ts"

test("every form of import is seen", () => {
  const dir = mkdtempSync(join(tmpdir(), "arch-"))
  const file = join(dir, "a.ts")
  writeFileSync(file, `import x from "one"\nimport { y } from 'two'\nimport "three"\nexport { z } from "four"\nconst w = await import("five")\nconst v = await import('six')\n`)
  assert.deepEqual(importsOf(file).sort(), ["five", "four", "one", "six", "three", "two"])
  // Words in strings are not imports: an error message saying "away from" stays a message.
  writeFileSync(file, `throw new Error("cannot point away from")\nconst s = "import me"\nimport {\n  a,\n  b,\n} from "seven"\n`)
  assert.deepEqual(importsOf(file), ["seven"])
})

test("product code never imports the testkit", () => {
  const root = fileURLToPath(new URL("../../../", import.meta.url))
  const dirs = ["src", "packages/react/src", "packages/core/src", "packages/markush/src", "packages/engine/src", "packages/ai/src", "packages/rdkit/src"]
  assert.deepEqual(dirs.flatMap((dir) => forbiddenImports(join(root, dir), (spec) => !spec.startsWith("@structura/testkit")).map((line) => `${dir}/${line}`)), [])
})
