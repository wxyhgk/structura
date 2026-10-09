import assert from "node:assert/strict"
import { dirname, relative, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { importsOf, sources } from "@structura/testkit/arch"

const CHEM = resolve(dirname(fileURLToPath(import.meta.url)), "../src")

/** Every import in the core, in every form, as paths relative to its src (or the bare package name). */
const imports = sources(CHEM).map((file) => {
  const targets = importsOf(file).map((spec) => (spec.startsWith(".") ? relative(CHEM, resolve(dirname(file), spec)) : spec))
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
    "molecule/relax",
  ].some((prefix) => path.startsWith(prefix))
const isDraw = (path: string) => path === "draw.ts" || path.startsWith("draw/")

test("the import scan actually sees imports", () => {
  const structure = imports.find(({ file }) => file === "ops/structure.ts")
  assert.ok(structure?.targets.includes("molecule.ts"))
})

test("chem only imports its own files and node builtins", () => {
  const outside = (target: string) => !target.startsWith("node:") && (target.startsWith("..") || !target.endsWith(".ts"))
  assert.deepEqual(violations(() => true, outside), [])
})

/** The package entry sits above everything, the renderer included. */
const isEntry = (path: string) => path === "index.ts"

test("nothing below the renderer imports it", () => {
  assert.deepEqual(violations((file) => !isDraw(file) && !isEntry(file), isDraw), [])
})

test("chemistry and file exchange never reach for layout or rendering", () => {
  const pure = (file: string) =>
    ["formula.ts", "validate.ts", "molfile.ts", "sdf.ts", "import.ts", "molecule/kekule.ts", "molecule/graph.ts", "molecule/selection.ts", "molecule/transform.ts", "molecule/cycles.ts"].includes(file)
  assert.deepEqual(violations(pure, (target) => isLayout(target) || isDraw(target)), [])
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
  const pure = ["formula.ts", "validate.ts", "molfile.ts", "sdf.ts", "import.ts", "drawing.ts", "history.ts", "molecule/kekule.ts", "molecule/graph.ts", "molecule/selection.ts", "molecule/transform.ts", "molecule/cycles.ts"]
  const leaks = pure.flatMap((file) =>
    [...reachable(file)]
      .filter((target) => isLayout(target) || isDraw(target) || isTemplates(target))
      .map((target) => `${file} ⇒ ${target}`),
  )
  assert.deepEqual(leaks, [])
})

test("the document model does not reach layout or rendering even through a barrel", () => {
  const pure = ["document.ts", "markush/names.ts", "markush/variables.ts", "markush/provisos.ts", "markush/closures.ts", "markush/attachments.ts", "markush/fragments.ts", "markush/bridges.ts", "label/known.ts"]
  const leaks = pure.flatMap((file) =>
    [...reachable(file)].filter((target) => isLayout(target) || isDraw(target) || target === "markush/templates.ts").map((target) => `${file} ⇒ ${target}`),
  )
  assert.deepEqual(leaks, [])
})

test("rendering does not reach layout even through a barrel", () => {
  const leaks = imports
    .filter(({ file }) => isDraw(file))
    .flatMap(({ file }) =>
      [...reachable(file)].filter((target) => isLayout(target) || isTemplates(target)).map((target) => `${file} ⇒ ${target}`),
    )
  assert.deepEqual(leaks, [])
})

test("no two chem files import each other, even through others or only for types", () => {
  const cycles = imports.filter(({ file }) => reachable(file).has(file)).map(({ file }) => file)
  assert.deepEqual(cycles, [])
})
