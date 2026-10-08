import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

/** A version as the registry and the CDN spell it ("2026.03.6" → "2026.3.6"). */
const normal = (version: string) => version.split(".").map((part) => String(Number(part))).join(".")

test("the RDKit wasm fetched by default is the release installed with the package, which is pinned exactly", () => {
  const installed = JSON.parse(readFileSync(new URL("../../../node_modules/@rdkit/rdkit/package.json", import.meta.url), "utf8")).version
  const source = readFileSync(new URL("../src/editor/rdkit.ts", import.meta.url), "utf8")
  const pinned = /RDKIT_VERSION = "([^"]+)"/.exec(source)?.[1]
  assert.equal(pinned, normal(installed))
  // The JS and its wasm must be the same release: a range could install newer JS than the wasm fetched.
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
  assert.equal(manifest.dependencies["@rdkit/rdkit"], pinned)
})
