import assert from "node:assert/strict"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { forbiddenImports, reachableFrom } from "@structura/testkit/arch"

const SRC = fileURLToPath(new URL("../../src/", import.meta.url))

/** What the published package is built from. */
const PUBLIC = ["index.ts", "core.ts", "chem.ts", "standalone.ts"]

// The site's 通式 page (variables, results, exports, the template library) lives in page/,
// reached through markushPage.ts; the editor in editor/. The page builds on the editor, never
// the other way: an import from the editor into page/ would ship the page to every embedder.

test("the published editor never reaches the 通式 page's code", () => {
  assert.deepEqual([...reachableFrom(SRC, PUBLIC)].filter((file) => file.startsWith("page/")).sort(), [])
})

test("the editor never imports from page/", () => {
  assert.deepEqual(forbiddenImports(join(SRC, "editor"), (spec) => !/(^|\/)page\//.test(spec)), [])
})

test("everything in page/ is the page's: its entry reaches it, and the published editor does not need it", () => {
  const page = reachableFrom(SRC, ["markushPage.ts"])
  assert.ok(page.has("page/workspace/ResultsPane.tsx") && page.has("page/MarkushEditor.tsx"), "the rules above see the page")
  const published = reachableFrom(SRC, PUBLIC)
  // A file under editor/ that only the page uses belongs in page/.
  assert.deepEqual([...page].filter((file) => file.startsWith("editor/") && !published.has(file)).sort(), [])
})
