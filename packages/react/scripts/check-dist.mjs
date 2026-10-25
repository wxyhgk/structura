// Checks the built package (dist/) the way another project meets it, in plain Node: the React
// entry renders on a server (Next.js, Remix… render components there first), and
// chem-structura/core works with no React and no browser. Run after the build:
// npm run check:dist -w chem-structura
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToString } from "react-dom/server"

const dist = new URL("../dist/", import.meta.url)

const { StructuraEditor } = await import(new URL("index.js", dist).href)
const html = renderToString(createElement(StructuraEditor, { initialMolfile: "" }))
assert.match(html, /chem-app/, "the editor renders on a server")
console.log("✔ the editor renders on a server")

const core = await import(new URL("core.js", dist).href)
const built = core.applyOps(core.emptyDrawing(), [{ op: "add_ring", at: { x: 0, y: 0 }, kind: "benzene" }])
assert.ok(built.ok)
assert.equal(core.plainFormula(built.drawing.molecule), "C6H6")
assert.match(core.drawingSvg(built.drawing), /<svg/)
console.log("✔ chem-structura/core builds and draws in Node")

/** Every built file read while following imports, for the checks after. */
const read = new Set()

/** What a built file imports from outside the package, chunks followed. */
function outsideImports(file, seen = new Set()) {
  if (seen.has(file)) return []
  seen.add(file)
  read.add(file)
  const code = readFileSync(new URL(file, dist), "utf8")
  const statements = /(?:^|;)\s*(?:import|export)\s*(?:[\w*{}\s,$]*?from\s*)?"([^"]+)"|\bimport\(\s*"([^"]+)"\s*\)/gm
  return [...code.matchAll(statements)].map((match) => match[1] ?? match[2]).flatMap((spec) =>
    spec.startsWith(".") ? outsideImports(new URL(spec, new URL(file, dist)).href.slice(dist.href.length), seen) : [spec],
  )
}
assert.deepEqual(outsideImports("core.js"), [], "core.js imports nothing")
assert.deepEqual(outsideImports("standalone.js"), [], "standalone.js brings everything with it")
console.log("✔ core.js and standalone.js import nothing from outside")

// Minified: no build comments, and (past a few lines' worth) long lines, not indented ones.
for (const file of read) {
  const code = readFileSync(new URL(file, dist), "utf8")
  const spread = code.length > 10_000 && code.split("\n").length > code.length / 1000
  assert.ok(!code.includes("//#region") && !spread, `${file} is minified`)
}
console.log(`✔ ${[...read].join(", ")} are minified`)

// The stylesheet styles the editor and nothing else: every rule but <chem-molecule>'s own and the
// popper wrappers' round its overlays matches only inside the editor's roots, so a Tailwind
// page's `.border-border` keeps the page's colour.
const { default: postcss } = await import("postcss")
const IN_EDITOR = ":where(.chem-app,.chem-app *,.chem-overlay,.chem-overlay *)"
const loose = []
postcss.parse(readFileSync(new URL("style.css", dist), "utf8")).walkRules((rule) => {
  if (rule.parent?.type === "atrule" && /keyframes$/.test(rule.parent.name)) return
  for (const selector of rule.selectors) {
    const onPage = selector.startsWith("chem-molecule") || selector.startsWith("[data-radix-popper-content-wrapper]:has(>.chem-overlay)")
    if (!onPage && !selector.includes(IN_EDITOR)) loose.push(selector)
  }
})
assert.deepEqual(loose.slice(0, 10), [], "every rule in style.css is confined to the editor")
console.log("✔ style.css styles nothing outside the editor")
