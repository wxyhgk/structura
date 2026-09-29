import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const CHEM = resolve(dirname(fileURLToPath(import.meta.url)), "../../src/chem")

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
  [
    "molecule/angles",
    "molecule/place",
    "molecule/rings",
    "molecule/fusion",
    "molecule/chair",
    "molecule/pointer",
    "molecule/snap",
    "molecule/abbreviate",
    "molecule/recipes",
    "molecule/grow",
  ].some((prefix) => path.startsWith(prefix))
const isDraw = (path: string) => path === "draw.ts" || path.startsWith("draw/")
const isHotkeys = (path: string) => path === "hotkeys.ts" || path.startsWith("hotkeys/")

test("the import scan actually sees imports", () => {
  const structure = imports.find(({ file }) => file === "ops/structure.ts")
  assert.ok(structure?.targets.includes("molecule.ts"))
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
    ["formula.ts", "validate.ts", "molfile.ts", "sdf.ts", "import.ts", "molecule/kekule.ts", "molecule/graph.ts"].includes(file)
  assert.deepEqual(violations(pure, (target) => isLayout(target) || isDraw(target) || isHotkeys(target)), [])
})

test("layout does not depend on hotkeys", () => {
  assert.deepEqual(violations(isLayout, isHotkeys), [])
})

/** Every file reachable from `file` through imports, not counting `file` itself. */
function reachable(file: string): Set<string> {
  const byFile = new Map(imports.map(({ file: name, targets }) => [name, targets]))
  const seen = new Set<string>()
  const stack = [...(byFile.get(file) ?? [])]
  while (stack.length > 0) {
    const next = stack.pop()!
    if (seen.has(next)) continue
    seen.add(next)
    stack.push(...(byFile.get(next) ?? []))
  }
  return seen
}

const isTemplates = (path: string) => path === "templates.ts" || path.startsWith("templates/")

test("chemistry, file exchange and history do not reach layout even through a barrel", () => {
  const pure = ["formula.ts", "validate.ts", "molfile.ts", "sdf.ts", "import.ts", "drawing.ts", "history.ts", "molecule/kekule.ts", "molecule/graph.ts"]
  const leaks = pure.flatMap((file) =>
    [...reachable(file)]
      .filter((target) => isLayout(target) || isDraw(target) || isHotkeys(target) || isTemplates(target))
      .map((target) => `${file} ⇒ ${target}`),
  )
  assert.deepEqual(leaks, [])
})

test("rendering does not reach layout or hotkeys even through a barrel", () => {
  const leaks = imports
    .filter(({ file }) => isDraw(file))
    .flatMap(({ file }) =>
      [...reachable(file)].filter((target) => isLayout(target) || isHotkeys(target) || isTemplates(target)).map((target) => `${file} ⇒ ${target}`),
    )
  assert.deepEqual(leaks, [])
})

test("only the hotkey op reaches the hotkey tables", () => {
  assert.deepEqual(violations((file) => !isHotkeys(file) && file !== "ops/structure.ts", isHotkeys), [])
})
