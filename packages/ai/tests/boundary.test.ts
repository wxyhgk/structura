import assert from "node:assert/strict"
import { dirname, relative, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { forbiddenImports, importsOf } from "@structura/testkit/arch"

const SRC = fileURLToPath(new URL("../src/", import.meta.url))

test("ai imports only its own files, core, markush, the model SDKs, resvg and node builtins", () => {
  const listed = ["@structura/core", "@structura/markush", "@anthropic-ai/sdk", "openai", "@resvg/resvg-js"]
  const allowed = (spec: string) => spec.startsWith(".") || spec.startsWith("node:") || listed.some((name) => spec === name || spec.startsWith(`${name}/`))
  assert.deepEqual(forbiddenImports(SRC, allowed), [])
})

test("the browser entry never reaches a model SDK, resvg or node, even through its own files", () => {
  const server = (spec: string) => spec.startsWith("node:") || spec.startsWith("@anthropic-ai/") || spec === "openai" || spec.startsWith("openai/") || spec.startsWith("@resvg/")
  const seen = new Set<string>()
  const problems: string[] = []
  const stack = [resolve(SRC, "index.ts")]
  while (stack.length > 0) {
    const file = stack.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    for (const spec of importsOf(file)) {
      if (spec.startsWith(".")) stack.push(resolve(dirname(file), spec))
      else if (server(spec)) problems.push(`${relative(SRC, file)}: ${spec}`)
    }
  }
  assert.ok(seen.size > 3, "the scan follows the entry's imports")
  assert.deepEqual(problems, [])
})
