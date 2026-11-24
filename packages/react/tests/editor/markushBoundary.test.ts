import assert from "node:assert/strict"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { reachableFrom } from "@structura/testkit/arch"

const SRC = fileURLToPath(new URL("../../src/", import.meta.url))

/** What the published package is built from. */
const PUBLIC = ["index.ts", "core.ts", "standalone.ts"]

/**
 * The files under editor/markush/ the drawing surface itself uses (variable attachments,
 * ring hints, bracket counts, what a variable is called), and so ship to everyone who embeds
 * the editor. Everything else there is the site's 通式 page.
 */
const SHARED = new Set(
  ["AttachmentLines.tsx", "AttachmentShapeMenu.tsx", "RingHint.tsx", "attachmentShapes.ts", "bracketCount.ts", "definitions.ts", "describe.ts", "variableNames.ts"].map((name) => `editor/markush/${name}`),
)

test("the published editor never reaches the 通式 page's code: an import from the canvas into it would ship it to every embedder", () => {
  const reached = reachableFrom(SRC, PUBLIC)
  const leaks = [...reached].filter((file) => file.startsWith("editor/markush/") && !SHARED.has(file)).sort()
  assert.deepEqual(leaks, [])
})

test("the rule above sees the page: its entry reaches the workspace, and every shared file is really used by the editor", () => {
  const page = reachableFrom(SRC, ["markushPage.ts"])
  assert.ok(page.has("editor/markush/workspace/ResultsPane.tsx") && page.has("editor/markush/MarkushEditor.tsx"))
  const reached = reachableFrom(SRC, PUBLIC)
  assert.deepEqual([...SHARED].filter((file) => !reached.has(file)), [], "a shared file the editor no longer uses belongs to the page")
})
