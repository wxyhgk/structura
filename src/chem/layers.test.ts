import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const CHEM = dirname(fileURLToPath(import.meta.url))

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sources(path)
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : []
  })
}

/** Every import in src/chem, as paths relative to src/chem (or the bare package name). */
const imports = sources(CHEM).map((file) => {
  const text = readFileSync(file, "utf8")
  const targets = [...text.matchAll(/from\s+"([^"]+)"/g)].map((match) => {
    const spec = match[1]
    return spec.startsWith(".") ? relative(CHEM, resolve(dirname(file), spec)) : spec
  })
  return { file: relative(CHEM, file), targets }
})

function violations(from: (file: string) => boolean, banned: (target: string) => boolean): string[] {
  return imports
    .filter(({ file }) => from(file))
    .flatMap(({ file, targets }) => targets.filter(banned).map((target) => `${file} → ${target}`))
}

const isLayout = (path: string) =>
  path.startsWith("molecule/place") || path.startsWith("molecule/snap") || path.startsWith("molecule/abbreviate")
const isDraw = (path: string) => path === "draw.ts" || path.startsWith("draw/")
const isHotkeys = (path: string) => path === "hotkeys.ts" || path.startsWith("hotkeys/")

test("the import scan actually sees imports", () => {
  const groups = imports.find(({ file }) => file === "hotkeys/groups.ts")
  assert.ok(groups?.targets.includes("molecule.ts"))
})

test("chem only imports its own files and node builtins", () => {
  const outside = (target: string) => !target.startsWith("node:") && (target.startsWith("..") || !target.endsWith(".ts"))
  assert.deepEqual(violations(() => true, outside), [])
})

test("nothing below the renderer imports it", () => {
  assert.deepEqual(violations((file) => !isDraw(file), isDraw), [])
})

test("chemistry and file exchange never reach for layout, rendering or hotkeys", () => {
  const pure = (file: string) =>
    ["formula.ts", "validate.ts", "molfile.ts", "molecule/kekule.ts", "molecule/graph.ts"].includes(file)
  assert.deepEqual(violations(pure, (target) => isLayout(target) || isDraw(target) || isHotkeys(target)), [])
})

test("layout does not depend on hotkeys", () => {
  assert.deepEqual(violations(isLayout, isHotkeys), [])
})
