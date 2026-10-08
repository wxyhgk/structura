// Writes dist/index.d.ts: the package's types in one file, with the types of Structura's own
// workspace packages (@structura/core, engine, markush…) bundled in, since those are not
// published. Step 1: tsc emits plain declarations for everything into .types/; step 2: rolldown
// joins them from the entry, mapping each @structura/… import to its emitted declaration.
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { rolldown } from "rolldown"
import { dts } from "rolldown-plugin-dts"

const here = dirname(dirname(fileURLToPath(import.meta.url)))
const root = resolve(here, "../..")
const out = join(here, ".types")
rmSync(out, { recursive: true, force: true })
execFileSync("npx", ["tsc", "-p", join(here, "tsconfig.build.json"), "--outDir", out], { stdio: "inherit", cwd: here })

/** The emitted declaration for a source file of the repo. */
const declarationOf = (source) => join(out, source.slice(root.length + 1).replace(/\.tsx?$/, ".d.ts"))

/** @structura/<pkg>[/<sub>] → the declaration emitted for its "structura-source" file. */
function workspaceDeclaration(id) {
  const [, name, sub] = /^@structura\/([^/]+)(\/.*)?$/.exec(id) ?? []
  if (!name) return null
  const pkgDir = join(root, "packages", name)
  const exports = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")).exports
  const entry = exports[sub ? `.${sub}` : "."]
  const source = typeof entry === "object" ? entry["structura-source"] : null
  return source ? declarationOf(join(pkgDir, source)) : null
}

const resolveDeclarations = {
  name: "structura-declarations",
  resolveId(id, importer) {
    if (id.startsWith("@structura/")) return workspaceDeclaration(id)
    // Sources import each other with .ts/.tsx extensions; their declarations sit beside as .d.ts.
    if (importer && id.startsWith(".") && /\.tsx?$/.test(id)) {
      const target = resolve(dirname(importer), id.replace(/\.tsx?$/, ".d.ts"))
      if (existsSync(target)) return target
    }
    return null
  },
}

const pkg = JSON.parse(readFileSync(join(here, "package.json"), "utf8"))
const external = [...Object.keys(pkg.peerDependencies), ...Object.keys(pkg.dependencies)]
const bundle = await rolldown({
  input: { index: declarationOf(join(here, "src/index.ts")) },
  external: (id) => external.some((name) => id === name || id.startsWith(`${name}/`)),
  plugins: [resolveDeclarations, dts({ dtsInput: true, emitDtsOnly: true })],
})
await bundle.write({ dir: join(here, "dist"), entryFileNames: "[name].d.ts" })
rmSync(out, { recursive: true, force: true })
